/**
 * AuraPOS - Point of Sale Unified Service Facade
 * Orchestrates calls across specialized domain services:
 * - SalesService (atomic checkout, receipts, refunds, held tickets)
 * - PaymentService (cash calculation, tender validation, change)
 * - InventoryService (stock deductions, restorations, adjustments, tracking)
 * - CustomerService (customer data, purchase metrics)
 * - DiscountService (discount computation, line-item distribution)
 * - TaxService (tax calculation)
 * - LoyaltyService (points accrual and redemption)
 */

import {
  CartItem,
  Customer,
  Discount,
  Employee,
  HeldOrder,
  PaymentRecord,
  Refund,
  Sale
} from '../types/pos.ts';
import { SalesService, ProcessSaleRequest } from './salesService.ts';
import { InventoryService } from './inventoryService.ts';

export type CheckoutRequest = ProcessSaleRequest;

export class PosService {
  /**
   * Processes a completed checkout transaction atomically.
   */
  static processSale(req: CheckoutRequest): { sale: Sale; offline: boolean } {
    return SalesService.processSale(req);
  }

  /**
   * Processes a return / refund for a past sale
   */
  static processRefund(
    sale: Sale,
    itemsToReturn: { saleItemId: string; quantity: number; amount: number; reason: string }[],
    totalRefundAmount: number,
    refundReason: string,
    refundMethod: 'cash' | 'card' | 'bank' | 'mobile',
    employee: Employee
  ): Refund {
    return SalesService.processRefund({
      sale,
      itemsToReturn,
      totalRefundAmount,
      refundReason,
      refundMethod,
      employee
    });
  }

  /**
   * Holds an open order so the cashier can start another customer
   */
  static holdOrder(
    items: CartItem[],
    customer: Customer | null,
    employee: Employee,
    subtotal: number,
    discountAmount: number,
    taxAmount: number,
    total: number,
    notes?: string
  ): HeldOrder {
    return SalesService.holdOrder({
      items,
      customer,
      employee,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      notes
    });
  }

  /**
   * Resumes and deletes a held order
   */
  static resumeHeldOrder(heldOrderId: string): HeldOrder | null {
    return SalesService.resumeHeldOrder(heldOrderId);
  }

  /**
   * Deletes a held order without resuming
   */
  static deleteHeldOrder(heldOrderId: string): void {
    SalesService.deleteHeldOrder(heldOrderId);
  }

  /**
   * Adjusts stock quantity manually
   */
  static adjustStock(
    productId: string,
    adjustmentType: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    employee: Employee
  ): void {
    InventoryService.adjustStock(productId, adjustmentType, quantity, reason, employee);
  }

  /**
   * Synchronizes queued offline transactions
   */
  static syncOfflineQueue(): number {
    return SalesService.syncOfflineQueue();
  }
}
