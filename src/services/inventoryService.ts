import { CartItem, Employee, InventoryMovement, Product, Category } from '../types/pos.ts';
import {
  Supplier,
  PurchaseOrder,
  StockCountSession,
  StockCountItem,
  InventoryValuationSummary
} from '../types/inventoryOperations.ts';
import { StorageService } from './storageService.ts';
import { Currency } from '../utils/currency.ts';

export interface StockValidationResult {
  valid: boolean;
  errors: string[];
}

export class InventoryService {
  /**
   * Validates whether all items in the cart are in stock according to store policy.
   */
  static validateCartStock(items: CartItem[], allowNegativeStock = false): StockValidationResult {
    if (allowNegativeStock) {
      return { valid: true, errors: [] };
    }

    const allProducts = StorageService.getProducts();
    const productQtyMap = new Map<string, number>();

    // Accumulate total quantity per product across possible different variants or entries
    for (const item of items) {
      const current = productQtyMap.get(item.productId) || 0;
      productQtyMap.set(item.productId, current + item.quantity);
    }

    const errors: string[] = [];

    productQtyMap.forEach((qtyNeeded, productId) => {
      const product = allProducts.find(p => p.id === productId);
      if (product && product.trackInventory) {
        if (product.stock < qtyNeeded) {
          errors.push(
            `Insufficient stock for "${product.name}": ${product.stock} available, ${qtyNeeded} requested.`
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Applies inventory deductions atomically for a completed sale and generates audit movements.
   * Returns the updated products list and new inventory movements.
   */
  static deductStockForSale(
    items: CartItem[],
    saleId: string,
    receiptNumber: string,
    employee: Employee,
    storeId: string
  ): { products: Product[]; movements: InventoryMovement[] } {
    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    // Accumulate requested deductions per product
    const qtyDeductions = new Map<string, number>();
    for (const item of items) {
      const current = qtyDeductions.get(item.productId) || 0;
      qtyDeductions.set(item.productId, current + item.quantity);
    }

    qtyDeductions.forEach((qtyToDeduct, productId) => {
      const pIndex = allProducts.findIndex(p => p.id === productId);
      if (pIndex !== -1) {
        const prod = allProducts[pIndex];
        if (prod.trackInventory) {
          const prevQty = prod.stock;
          const newQty = Math.max(0, prevQty - qtyToDeduct);

          allProducts[pIndex] = {
            ...prod,
            stock: newQty,
            updatedAt: nowIso
          };

          const movement: InventoryMovement = {
            id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            storeId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'sale',
            quantity: -qtyToDeduct,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `POS Sale ${receiptNumber}`,
            referenceId: saleId,
            employeeId: employee.id,
            employeeName: employee.name,
            createdAt: nowIso
          };

          newMovements.push(movement);
        }
      }
    });

    // Save updated products and movements to storage
    StorageService.saveProducts(allProducts);
    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { products: allProducts, movements: allMovements };
  }

  /**
   * Restores inventory for returned/refunded items.
   */
  static restoreStockForRefund(
    items: { productId: string; quantity: number; reason: string }[],
    refundId: string,
    receiptNumber: string,
    employee: Employee,
    storeId: string
  ): { products: Product[]; movements: InventoryMovement[] } {
    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    items.forEach(item => {
      const pIndex = allProducts.findIndex(p => p.id === item.productId);
      if (pIndex !== -1) {
        const prod = allProducts[pIndex];
        if (prod.trackInventory) {
          const prevQty = prod.stock;
          const newQty = prevQty + item.quantity;

          allProducts[pIndex] = {
            ...prod,
            stock: newQty,
            updatedAt: nowIso
          };

          const movement: InventoryMovement = {
            id: `mov_ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            storeId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'refund',
            quantity: item.quantity,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Refund for receipt ${receiptNumber}: ${item.reason}`,
            referenceId: refundId,
            employeeId: employee.id,
            employeeName: employee.name,
            createdAt: nowIso
          };

          newMovements.push(movement);
        }
      }
    });

    StorageService.saveProducts(allProducts);
    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { products: allProducts, movements: allMovements };
  }

  /**
   * Manual stock adjustment
   */
  static adjustStock(
    productId: string,
    adjustmentType: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    employee: Employee
  ): void {
    const allProducts = StorageService.getProducts();
    const pIndex = allProducts.findIndex(p => p.id === productId);
    if (pIndex === -1) return;

    const prod = allProducts[pIndex];
    const prevQty = prod.stock;
    let newQty = prevQty;

    if (adjustmentType === 'add') {
      newQty = prevQty + quantity;
    } else if (adjustmentType === 'remove') {
      newQty = Math.max(0, prevQty - quantity);
    } else {
      newQty = Math.max(0, quantity);
    }

    const delta = newQty - prevQty;
    const nowIso = new Date().toISOString();

    allProducts[pIndex] = {
      ...prod,
      stock: newQty,
      updatedAt: nowIso
    };
    StorageService.saveProducts(allProducts);

    const movements = StorageService.getInventoryMovements();
    movements.unshift({
      id: `mov_adj_${Date.now()}`,
      storeId: StorageService.getSettings().id,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      type: 'adjustment',
      quantity: delta,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reason,
      employeeId: employee.id,
      employeeName: employee.name,
      createdAt: nowIso
    });
    StorageService.saveInventoryMovements(movements);
  }

  /**
   * Calculate full inventory valuation summary
   */
  static getValuationSummary(products: Product[]): InventoryValuationSummary {
    const tracked = products.filter(p => p.trackInventory);
    const totalUnits = tracked.reduce((acc, p) => acc + Math.max(0, p.stock), 0);

    let retailCents = 0;
    let costCents = 0;

    tracked.forEach(p => {
      const qty = Math.max(0, p.stock);
      retailCents += Currency.toCents(p.price * qty);
      costCents += Currency.toCents(p.cost * qty);
    });

    const totalRetailValue = Currency.toDollars(retailCents);
    const totalCostValue = Currency.toDollars(costCents);
    const potentialGrossProfit = Currency.toDollars(Math.max(0, retailCents - costCents));
    const overallMarginPct =
      totalRetailValue > 0 ? Math.round((potentialGrossProfit / totalRetailValue) * 1000) / 10 : 0;

    const lowStockItemsCount = tracked.filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold).length;
    const outOfStockItemsCount = tracked.filter(p => p.stock <= 0).length;

    return {
      totalTrackedProducts: tracked.length,
      totalUnitsInStock: totalUnits,
      totalRetailValue,
      totalCostValue,
      potentialGrossProfit,
      overallMarginPct,
      lowStockItemsCount,
      outOfStockItemsCount
    };
  }

  /**
   * Create physical stock count session
   */
  static createStockCountSession(
    storeId: string,
    conductedBy: string,
    title: string = 'Full Physical Stock Count',
    initialItems?: StockCountItem[]
  ): StockCountSession {
    const allProducts = StorageService.getProducts();
    const tracked = allProducts.filter(p => p.trackInventory);

    const items: StockCountItem[] =
      initialItems ||
      tracked.map(p => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        systemExpectedStock: p.stock,
        countedStock: p.stock, // Default matches system until adjusted
        varianceUnits: 0,
        unitCost: p.cost,
        varianceValue: 0
      }));

    const session: StockCountSession = {
      id: `sc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId,
      title,
      status: 'draft',
      items,
      totalVarianceUnits: 0,
      totalVarianceValue: 0,
      conductedBy,
      startedAt: new Date().toISOString()
    };

    const sessions = StorageService.getStockCountSessions();
    sessions.unshift(session);
    StorageService.saveStockCountSessions(sessions);

    return session;
  }

  /**
   * Commit physical stock count session and reconcile system inventory
   */
  static commitStockCountSession(
    sessionId: string,
    conductedBy: string
  ): { session: StockCountSession; products: Product[]; movements: InventoryMovement[] } {
    const sessions = StorageService.getStockCountSessions();
    const sIndex = sessions.findIndex(s => s.id === sessionId);
    if (sIndex === -1) throw new Error(`Stock count session ${sessionId} not found`);

    const session = sessions[sIndex];
    if (session.status === 'completed') {
      return {
        session,
        products: StorageService.getProducts(),
        movements: StorageService.getInventoryMovements()
      };
    }

    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    let totalVarianceUnits = 0;
    let totalVarianceValueCents = 0;

    session.items.forEach(item => {
      const varianceUnits = item.countedStock - item.systemExpectedStock;
      const varianceValue = varianceUnits * item.unitCost;

      item.varianceUnits = varianceUnits;
      item.varianceValue = varianceValue;

      totalVarianceUnits += varianceUnits;
      totalVarianceValueCents += Currency.toCents(varianceValue);

      if (varianceUnits !== 0) {
        const pIndex = allProducts.findIndex(p => p.id === item.productId);
        if (pIndex !== -1) {
          const prod = allProducts[pIndex];
          const prevQty = prod.stock;
          const newQty = item.countedStock;

          allProducts[pIndex] = {
            ...prod,
            stock: newQty,
            updatedAt: nowIso
          };

          const movement: InventoryMovement = {
            id: `mov_cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            storeId: session.storeId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'count',
            quantity: varianceUnits,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Physical Count Reconciliation (${session.title}): ${varianceUnits > 0 ? '+' : ''}${varianceUnits} units`,
            referenceId: session.id,
            employeeId: 'staff_auditor',
            employeeName: conductedBy,
            createdAt: nowIso
          };

          newMovements.push(movement);
        }
      }
    });

    session.status = 'completed';
    session.completedAt = nowIso;
    session.totalVarianceUnits = totalVarianceUnits;
    session.totalVarianceValue = Currency.toDollars(totalVarianceValueCents);
    sessions[sIndex] = session;

    StorageService.saveStockCountSessions(sessions);
    StorageService.saveProducts(allProducts);

    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { session, products: allProducts, movements: allMovements };
  }

  /**
   * Create Purchase Order
   */
  static createPurchaseOrder(
    poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>
  ): PurchaseOrder {
    const totalAmount = poData.items.reduce((acc, i) => acc + i.totalCost, 0);
    const nowIso = new Date().toISOString();

    const newPO: PurchaseOrder = {
      id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...poData,
      totalAmount
    };

    const orders = StorageService.getPurchaseOrders();
    orders.unshift(newPO);
    StorageService.savePurchaseOrders(orders);

    return newPO;
  }

  /**
   * Receive Purchase Order: Updates stock and records audit movements
   */
  static receivePurchaseOrder(
    poId: string,
    receivedBy: string
  ): { order: PurchaseOrder; products: Product[]; movements: InventoryMovement[] } {
    const orders = StorageService.getPurchaseOrders();
    const poIndex = orders.findIndex(o => o.id === poId);
    if (poIndex === -1) throw new Error(`Purchase order ${poId} not found`);

    const po = orders[poIndex];
    if (po.status === 'received') {
      return {
        order: po,
        products: StorageService.getProducts(),
        movements: StorageService.getInventoryMovements()
      };
    }

    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    po.items.forEach(item => {
      const pIndex = allProducts.findIndex(p => p.id === item.productId);
      if (pIndex !== -1) {
        const prod = allProducts[pIndex];
        const prevQty = prod.stock;
        const newQty = prevQty + item.quantityOrdered;

        item.quantityReceived = item.quantityOrdered;

        allProducts[pIndex] = {
          ...prod,
          stock: newQty,
          cost: item.unitCost, // Update latest purchasing cost
          updatedAt: nowIso
        };

        const movement: InventoryMovement = {
          id: `mov_po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          storeId: po.storeId,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'purchase',
          quantity: item.quantityOrdered,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reason: `PO Received: ${po.poNumber} (${po.supplierName})`,
          referenceId: po.id,
          employeeId: 'staff_receiver',
          employeeName: receivedBy,
          createdAt: nowIso
        };

        newMovements.push(movement);
      }
    });

    po.status = 'received';
    po.receivedDate = nowIso;
    po.updatedAt = nowIso;
    orders[poIndex] = po;

    StorageService.savePurchaseOrders(orders);
    StorageService.saveProducts(allProducts);

    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { order: po, products: allProducts, movements: allMovements };
  }

  /**
   * RFC 4180 CSV Export: Inventory Valuation & Stock Ledger
   */
  static generateInventoryValuationCsv(products: Product[], categories: Category[]): string {
    const valuation = this.getValuationSummary(products);
    const lines: string[] = [
      'AuraPOS — Inventory Valuation & Stock Audit Report',
      `Generated:,"${new Date().toISOString()}"`,
      '',
      'VALUATION SUMMARY,Value (USD)',
      `Tracked Product SKUs,${valuation.totalTrackedProducts}`,
      `Total Physical Units,${valuation.totalUnitsInStock}`,
      `Total Retail Inventory Value,${valuation.totalRetailValue.toFixed(2)}`,
      `Total Cost Inventory Value,${valuation.totalCostValue.toFixed(2)}`,
      `Potential Gross Margin,${valuation.potentialGrossProfit.toFixed(2)}`,
      `Overall Margin %,${valuation.overallMarginPct}%`,
      `Low Stock Alert Items,${valuation.lowStockItemsCount}`,
      `Out of Stock Items,${valuation.outOfStockItemsCount}`,
      '',
      'INVENTORY MASTER ITEM LEDGER',
      'Product Name,SKU,Barcode,Category,Stock Units,Min Threshold,Unit Cost,Retail Price,Total Retail Value,Total Cost Value,Status',
      ...products.map(p => {
        const cat = categories.find(c => c.id === p.categoryId);
        const retailVal = p.price * p.stock;
        const costVal = p.cost * p.stock;
        const status = !p.trackInventory
          ? 'Untracked'
          : p.stock <= 0
          ? 'OUT OF STOCK'
          : p.stock <= p.lowStockThreshold
          ? 'LOW STOCK'
          : 'HEALTHY';
        return `"${p.name}","${p.sku}","${p.barcode || ''}","${cat?.name || 'Uncategorized'}",${p.stock},${p.lowStockThreshold},${p.cost.toFixed(2)},${p.price.toFixed(2)},${retailVal.toFixed(2)},${costVal.toFixed(2)},"${status}"`;
      })
    ];

    return lines.join('\r\n');
  }

  /**
   * RFC 4180 CSV Export: Stock Movements Ledger
   */
  static generateMovementsCsv(movements: InventoryMovement[]): string {
    const lines: string[] = [
      'AuraPOS — Historical Stock Movement Ledger',
      `Generated:,"${new Date().toISOString()}"`,
      `Total Movement Records:,${movements.length}`,
      '',
      'Date / Time,Product Name,SKU,Movement Type,Qty Delta,Previous Qty,New Qty,Reason,Staff Member,Reference ID',
      ...movements.map(
        m =>
          `"${m.createdAt}","${m.productName}","${m.sku}","${m.type.toUpperCase()}",${m.quantity},${m.previousQuantity},${m.newQuantity},"${m.reason}","${m.employeeName}","${m.referenceId || ''}"`
      )
    ];

    return lines.join('\r\n');
  }
}
