import { PaymentMethod, PaymentRecord } from '../types/pos.ts';
import { Currency } from '../utils/currency.ts';

export interface ChangeCalculationResult {
  tenderedDollars: number;
  tenderedCents: number;
  grandTotalDollars: number;
  grandTotalCents: number;
  changeDueDollars: number;
  changeDueCents: number;
  isInsufficient: boolean;
  shortfallDollars: number;
}

export class PaymentService {
  /**
   * Safely calculates cash change and checks sufficiency avoiding floating point issues.
   */
  static calculateCashChange(tenderedInput: number | string, grandTotalDollars: number): ChangeCalculationResult {
    const parsedTender = typeof tenderedInput === 'string' ? parseFloat(tenderedInput) : tenderedInput;
    const safeTender = isNaN(parsedTender) ? 0 : Math.max(0, parsedTender);

    const tenderedCents = Currency.toCents(safeTender);
    const grandTotalCents = Currency.toCents(grandTotalDollars);

    const isInsufficient = tenderedCents < grandTotalCents;
    const diffCents = tenderedCents - grandTotalCents;

    const changeDueCents = isInsufficient ? 0 : diffCents;
    const shortfallCents = isInsufficient ? Math.abs(diffCents) : 0;

    return {
      tenderedDollars: Currency.toDollars(tenderedCents),
      tenderedCents,
      grandTotalDollars: Currency.toDollars(grandTotalCents),
      grandTotalCents,
      changeDueDollars: Currency.toDollars(changeDueCents),
      changeDueCents,
      isInsufficient,
      shortfallDollars: Currency.toDollars(shortfallCents)
    };
  }

  /**
   * Formats cash change due as clean dollar string
   */
  static formatChange(tenderedInput: number | string, grandTotalDollars: number): string {
    const res = this.calculateCashChange(tenderedInput, grandTotalDollars);
    return res.changeDueDollars.toFixed(2);
  }

  /**
   * Constructs a typed PaymentRecord
   */
  static createPaymentRecord(params: {
    method: PaymentMethod;
    amount: number;
    tendered?: number;
    change?: number;
    transactionReference?: string;
    saleId?: string;
  }): PaymentRecord {
    const nowIso = new Date().toISOString();
    return {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      saleId: params.saleId,
      method: params.method,
      amount: Number(params.amount.toFixed(2)),
      tendered: params.tendered !== undefined ? Number(params.tendered.toFixed(2)) : undefined,
      change: params.change !== undefined ? Number(params.change.toFixed(2)) : undefined,
      transactionReference: params.transactionReference,
      status: 'completed',
      createdAt: nowIso
    };
  }

  /**
   * Suggests quick tender dollar amounts based on total
   */
  static getQuickTenderAmounts(grandTotalDollars: number): number[] {
    const ceilTotal = Math.ceil(grandTotalDollars);
    const options = new Set<number>();

    // Common standard bill denominations above or equal to grand total
    [10, 20, 50, 100].forEach(denom => {
      if (denom >= grandTotalDollars) {
        options.add(denom);
      }
    });

    // Next nearest $5 or $10 increment
    const nextFive = Math.ceil(ceilTotal / 5) * 5;
    if (nextFive > grandTotalDollars && nextFive <= 100) {
      options.add(nextFive);
    }
    const nextTen = Math.ceil(ceilTotal / 10) * 10;
    if (nextTen > grandTotalDollars && nextTen <= 100) {
      options.add(nextTen);
    }

    const sorted = Array.from(options).sort((a, b) => a - b);
    return sorted.slice(0, 4);
  }
}
