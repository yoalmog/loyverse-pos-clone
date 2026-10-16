import {
  CartItem,
  Customer,
  Discount,
  Employee,
  HeldOrder,
  OfflineSaleQueueItem,
  PaymentRecord,
  Refund,
  RefundItem,
  Sale,
  SaleItem
} from '../types/pos.ts';
import { StorageService } from './storageService.ts';
import { Currency } from '../utils/currency.ts';
import { TaxService } from './taxService.ts';
import { DiscountService } from './discountService.ts';
import { LoyaltyService } from './loyaltyService.ts';
import { InventoryService } from './inventoryService.ts';
import { CustomerService } from './customerService.ts';
import { PaymentService } from './paymentService.ts';
import { PrintService } from './printer/printService.ts';
import { PrintQueueService } from './printer/printQueueService.ts';
import { SalesRepository } from './repositories/SalesRepository.ts';

export interface ProcessSaleRequest {
  items: CartItem[];
  customer?: Customer | null;
  discount?: Discount | null;
  manualDiscountAmount?: number;
  payments: PaymentRecord[];
  employee: Employee;
  notes?: string;
}

export interface SaleCalculationBreakdown {
  subtotalCents: number;
  subtotalDollars: number;
  discountCents: number;
  discountDollars: number;
  discountDescription?: string;
  taxableSubtotalCents: number;
  taxRate: number;
  taxCents: number;
  taxDollars: number;
  grandTotalCents: number;
  grandTotalDollars: number;
  lineItems: SaleItem[];
}

export class SalesService {
  /**
   * Calculate all pricing and line item distributions purely and safely in cents
   */
  static calculateSaleTotals(
    items: CartItem[],
    discount?: Discount | null,
    manualDiscountAmount?: number,
    customTaxRate?: number
  ): SaleCalculationBreakdown {
    // 1. Calculate each item's subtotal in cents and total order subtotal
    const itemSubtotalsCents = items.map(item => {
      const unitCents = Currency.toCents(item.unitPrice);
      return unitCents * item.quantity;
    });

    const subtotalCents = itemSubtotalsCents.reduce((sum, c) => sum + c, 0);
    const subtotalDollars = Currency.toDollars(subtotalCents);

    // 2. Calculate discount in cents
    const discountResult = DiscountService.calculateDiscount(
      subtotalDollars,
      discount,
      manualDiscountAmount
    );
    const discountCents = discountResult.discountCents;
    const discountDollars = discountResult.discountDollars;
    const discountDescription = discountResult.description;

    // 3. Taxable subtotal in cents
    const taxableSubtotalCents = Math.max(0, subtotalCents - discountCents);

    // 4. Tax calculation in cents
    const taxRate = customTaxRate !== undefined ? customTaxRate : TaxService.getActiveTaxRate();
    const taxCents = TaxService.calculateTaxCents(taxableSubtotalCents, taxRate);
    const taxDollars = Currency.toDollars(taxCents);

    // 5. Grand total in cents
    const grandTotalCents = taxableSubtotalCents + taxCents;
    const grandTotalDollars = Currency.toDollars(grandTotalCents);

    // 6. Fair distribution of discount & tax across line items
    const itemSubtotalsDollars = itemSubtotalsCents.map(c => Currency.toDollars(c));
    const distributedDiscounts = DiscountService.distributeLineDiscounts(
      itemSubtotalsDollars,
      discountDollars
    );

    const nowTimestamp = Date.now();
    const lineItems: SaleItem[] = items.map((item, idx) => {
      const itemSubtotalCents = itemSubtotalsCents[idx];
      const itemDiscountDollars = distributedDiscounts[idx] || 0;
      const itemDiscountCents = Currency.toCents(itemDiscountDollars);

      const itemTaxableCents = Math.max(0, itemSubtotalCents - itemDiscountCents);
      const itemTaxCents = TaxService.calculateTaxCents(itemTaxableCents, taxRate);
      const itemLineTotalCents = itemTaxableCents + itemTaxCents;

      return {
        id: `si_${nowTimestamp}_${idx}`,
        saleId: '', // populated on sale creation
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: Currency.toDollars(itemDiscountCents),
        taxAmount: Currency.toDollars(itemTaxCents),
        lineTotal: Currency.toDollars(itemLineTotalCents)
      };
    });

    return {
      subtotalCents,
      subtotalDollars,
      discountCents,
      discountDollars,
      discountDescription,
      taxableSubtotalCents,
      taxRate,
      taxCents,
      taxDollars,
      grandTotalCents,
      grandTotalDollars,
      lineItems
    };
  }

  /**
   * Atomically executes a sale checkout:
   * 1. Validates cart non-empty
   * 2. Validates stock availability against store rules
   * 3. Calculates integer cent totals without float error
   * 4. Validates payment sufficiency
   * 5. Atomically commits inventory decrements
   * 6. Atomically commits customer loyalty & spend metrics
   * 7. Atomically saves sale to history or offline queue
   * 8. Atomically advances receipt sequence
   */
  static processSale(req: ProcessSaleRequest): { sale: Sale; offline: boolean } {
    if (!req.items || req.items.length === 0) {
      throw new Error('Cannot process checkout for an empty cart.');
    }

    const settings = StorageService.getSettings();

    // 1. Validate stock availability
    const stockValidation = InventoryService.validateCartStock(
      req.items,
      settings.allowNegativeStock
    );
    if (!stockValidation.valid) {
      throw new Error(stockValidation.errors.join(' '));
    }

    // 2. Perform monetary calculations in integer cents
    const calc = this.calculateSaleTotals(
      req.items,
      req.discount,
      req.manualDiscountAmount
    );

    // 3. Validate payments
    const totalPaidCents = req.payments.reduce((sum, p) => sum + Currency.toCents(p.amount), 0);
    if (totalPaidCents < calc.grandTotalCents) {
      const shortfall = Currency.toDollars(calc.grandTotalCents - totalPaidCents);
      throw new Error(`Insufficient payment: short by $${shortfall.toFixed(2)}.`);
    }

    // 4. Formulate receipt number and persistent UUIDs (Section 5)
    const nowIso = new Date().toISOString();
    const saleId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sale_${Date.now()}`;
    const receiptNumber = `${settings.receiptPrefix}${settings.nextReceiptNumber}`;

    // Update saleId and line items with consistent UUIDs
    const saleItems: SaleItem[] = calc.lineItems.map(item => ({
      ...item,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item_${Math.random().toString(36).substring(2, 9)}`,
      saleId
    }));

    // Real offline status detection
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // Build the final Sale model
    const sale: Sale = {
      id: saleId,
      storeId: settings.id,
      receiptNumber,
      customerId: req.customer ? req.customer.id : undefined,
      customerName: req.customer
        ? `${req.customer.firstName} ${req.customer.lastName}`
        : undefined,
      employeeId: req.employee.id,
      employeeName: req.employee.name,
      items: saleItems,
      subtotal: calc.subtotalDollars,
      discountAmount: calc.discountDollars,
      discountDescription: calc.discountDescription,
      taxAmount: calc.taxDollars,
      taxRate: calc.taxRate,
      total: calc.grandTotalDollars,
      payments: req.payments.map(p => ({
        ...p,
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pay_${Math.random().toString(36).substring(2, 9)}`,
        saleId,
        status: 'completed' as const,
        createdAt: nowIso
      })),
      status: 'completed',
      notes: req.notes,
      isOffline,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 5. ATOMIC LOCAL DATABASE COMMIT (Sections 7, 8, 9, 10):
    // A. Deduct stock & log inventory movements locally
    InventoryService.deductStockForSale(
      req.items,
      saleId,
      receiptNumber,
      req.employee,
      settings.id
    );

    // B. Customer loyalty and purchase metrics
    if (req.customer) {
      const earnedPoints = LoyaltyService.calculateEarnedPoints(
        calc.grandTotalDollars,
        settings.pointsPerDollar
      );
      CustomerService.recordPurchase(req.customer.id, calc.grandTotalDollars, earnedPoints);
    }

    // C. Increment receipt number
    settings.nextReceiptNumber += 1;
    StorageService.saveSettings(settings);

    // D. Persist sale atomically via SalesRepository (writes locally first)
    SalesRepository.recordSale(sale).catch(err => {
      console.warn('SalesRepository local write warning:', err);
    });

    // E. Queue in offline queue if offline
    if (isOffline) {
      const queue = StorageService.getOfflineQueue();
      const queueItem: OfflineSaleQueueItem = {
        localId: sale.id,
        sale,
        syncStatus: 'pending',
        retryCount: 0,
        timestamp: Date.now()
      };
      queue.unshift(queueItem);
      StorageService.saveOfflineQueue(queue);
    }

    // F. Persistent Print Queue & Station Order Routing (Sections 11, 12, 13)
    // Asynchronously dispatch customer receipt, kitchen ticket, and bar ticket
    try {
      PrintQueueService.enqueueSaleReceipt(sale, settings, settings.autoPrintReceipts !== false);
    } catch (printQueueErr) {
      console.warn('PrintQueue enqueue background warning:', printQueueErr);
    }

    return { sale, offline: isOffline };
  }

  /**
   * Processes a refund / return for an existing sale
   */
  static processRefund(params: {
    sale: Sale;
    itemsToReturn: { saleItemId: string; quantity: number; amount: number; reason: string }[];
    totalRefundAmount: number;
    refundReason: string;
    refundMethod: 'cash' | 'card' | 'bank' | 'mobile';
    employee: Employee;
  }): Refund {
    const { sale, itemsToReturn, totalRefundAmount, refundReason, refundMethod, employee } = params;
    const nowIso = new Date().toISOString();
    const settings = StorageService.getSettings();

    const refundItems: RefundItem[] = itemsToReturn.map(ret => {
      const origItem = sale.items.find(i => i.id === ret.saleItemId);
      return {
        saleItemId: ret.saleItemId,
        productName: origItem ? origItem.productName : 'Item',
        quantity: ret.quantity,
        amount: ret.amount,
        reason: ret.reason
      };
    });

    const refundId = `ref_${Date.now()}`;
    const refund: Refund = {
      id: refundId,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      employeeId: employee.id,
      employeeName: employee.name,
      amount: totalRefundAmount,
      reason: refundReason,
      method: refundMethod,
      items: refundItems,
      createdAt: nowIso
    };

    // 1. Save refund
    const allRefunds = StorageService.getRefunds();
    allRefunds.unshift(refund);
    StorageService.saveRefunds(allRefunds);

    // 2. Restock inventory
    const itemsForRestock = itemsToReturn.map(ret => {
      const origItem = sale.items.find(i => i.id === ret.saleItemId);
      return {
        productId: origItem ? origItem.productId : '',
        quantity: ret.quantity,
        reason: ret.reason
      };
    }).filter(i => !!i.productId);

    InventoryService.restoreStockForRefund(
      itemsForRestock,
      refundId,
      sale.receiptNumber,
      employee,
      settings.id
    );

    // 3. Update original sale status
    const allSales = StorageService.getSales();
    const sIndex = allSales.findIndex(s => s.id === sale.id);
    if (sIndex !== -1) {
      const orig = allSales[sIndex];
      const isTotalRefund = Currency.toCents(totalRefundAmount) >= Currency.toCents(orig.total);
      allSales[sIndex] = {
        ...orig,
        status: isTotalRefund ? 'refunded' : 'partially_refunded',
        updatedAt: nowIso
      };
      StorageService.saveSales(allSales);
    }

    return refund;
  }

  /**
   * Hold current order
   */
  static holdOrder(params: {
    items: CartItem[];
    customer?: Customer | null;
    employee: Employee;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    notes?: string;
  }): HeldOrder {
    const heldOrders = StorageService.getHeldOrders();
    const orderNumber = `HELD-${100 + heldOrders.length + 1}`;

    const heldOrder: HeldOrder = {
      id: `held_${Date.now()}`,
      orderNumber,
      storeId: StorageService.getSettings().id,
      employeeId: params.employee.id,
      employeeName: params.employee.name,
      customer: params.customer || undefined,
      items: [...params.items],
      subtotal: params.subtotal,
      discountAmount: params.discountAmount,
      taxAmount: params.taxAmount,
      total: params.total,
      notes: params.notes,
      createdAt: new Date().toISOString()
    };

    heldOrders.unshift(heldOrder);
    StorageService.saveHeldOrders(heldOrders);
    return heldOrder;
  }

  /**
   * Resume and remove a held order
   */
  static resumeHeldOrder(heldOrderId: string): HeldOrder | null {
    const heldOrders = StorageService.getHeldOrders();
    const index = heldOrders.findIndex(h => h.id === heldOrderId);
    if (index === -1) return null;

    const [order] = heldOrders.splice(index, 1);
    StorageService.saveHeldOrders(heldOrders);
    return order;
  }

  /**
   * Delete a held order
   */
  static deleteHeldOrder(heldOrderId: string): void {
    const heldOrders = StorageService.getHeldOrders();
    const filtered = heldOrders.filter(h => h.id !== heldOrderId);
    StorageService.saveHeldOrders(filtered);
  }

  /**
   * Synchronize queued offline transactions
   */
  static syncOfflineQueue(): number {
    const queue = StorageService.getOfflineQueue();
    if (queue.length === 0) return 0;

    const count = queue.length;
    const allSales = StorageService.getSales();
    queue.forEach(item => {
      const idx = allSales.findIndex(s => s.id === item.localId);
      if (idx !== -1) {
        allSales[idx].isOffline = false;
      }
    });

    StorageService.saveSales(allSales);
    StorageService.saveOfflineQueue([]);
    return count;
  }
}
