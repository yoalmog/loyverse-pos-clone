import { Discount } from '../types/pos.ts';
import { Currency } from '../utils/currency.ts';

export interface DiscountCalculationResult {
  discountCents: number;
  discountDollars: number;
  description?: string;
  applied: boolean;
  reason?: string;
}

export class DiscountService {
  /**
   * Calculate discount amount in cents and dollars safely
   */
  static calculateDiscount(
    subtotalDollars: number,
    discount?: Discount | null,
    manualDiscountDollars?: number
  ): DiscountCalculationResult {
    const subtotalCents = Currency.toCents(subtotalDollars);
    if (subtotalCents <= 0) {
      return { discountCents: 0, discountDollars: 0, applied: false };
    }

    if (discount) {
      // Check minimum purchase condition
      if (discount.minimumPurchase && subtotalDollars < discount.minimumPurchase) {
        return {
          discountCents: 0,
          discountDollars: 0,
          applied: false,
          reason: `Requires minimum purchase of $${discount.minimumPurchase.toFixed(2)}`
        };
      }

      let discountCents = 0;
      if (discount.type === 'percentage') {
        discountCents = Math.round((subtotalCents * discount.value) / 100);
      } else {
        const fixedCents = Currency.toCents(discount.value);
        discountCents = Math.min(fixedCents, subtotalCents);
      }

      if (discount.maximumDiscount) {
        const maxCents = Currency.toCents(discount.maximumDiscount);
        if (discountCents > maxCents) {
          discountCents = maxCents;
        }
      }

      // Ensure discount doesn't exceed subtotal
      discountCents = Math.min(discountCents, subtotalCents);

      const description = `${discount.name} (${discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value.toFixed(2)}`})`;

      return {
        discountCents,
        discountDollars: Currency.toDollars(discountCents),
        description,
        applied: discountCents > 0
      };
    }

    if (manualDiscountDollars && manualDiscountDollars > 0) {
      const manualCents = Currency.toCents(manualDiscountDollars);
      const discountCents = Math.min(manualCents, subtotalCents);
      return {
        discountCents,
        discountDollars: Currency.toDollars(discountCents),
        description: 'Custom Discount',
        applied: discountCents > 0
      };
    }

    return { discountCents: 0, discountDollars: 0, applied: false };
  }

  /**
   * Distribute discount proportionally across multiple line items.
   * Uses penny-rounding allocation to guarantee the sum of item discounts equals the total discount exactly.
   */
  static distributeLineDiscounts(
    lineItemSubtotalsDollars: number[],
    totalDiscountDollars: number
  ): number[] {
    return Currency.distributeDiscount(lineItemSubtotalsDollars, totalDiscountDollars);
  }
}
