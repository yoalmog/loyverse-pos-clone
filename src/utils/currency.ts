/**
 * Currency and Precision Math Utility for POS
 * Avoids floating-point arithmetic errors by calculating in integer minor currency units (cents).
 */

export class Currency {
  /**
   * Convert decimal dollar amount to integer cents
   * e.g. 19.99 -> 1999, 12.005 -> 1201
   */
  static toCents(dollars: number): number {
    if (!dollars || isNaN(dollars)) return 0;
    return Math.round(Number((dollars * 100).toFixed(6)));
  }

  /**
   * Convert integer cents back to dollar number with 2 decimals
   * e.g. 1999 -> 19.99
   */
  static toDollars(cents: number): number {
    if (!cents || isNaN(cents)) return 0;
    return Number((cents / 100).toFixed(2));
  }

  /**
   * Format cents as formatted currency string e.g. "$19.99"
   */
  static formatCents(cents: number, symbol = '$'): string {
    const dollars = this.toDollars(cents);
    return `${symbol}${dollars.toFixed(2)}`;
  }

  /**
   * Format dollar float safely
   */
  static formatDollars(dollars: number, symbol = '$'): string {
    const cents = this.toCents(dollars);
    return this.formatCents(cents, symbol);
  }

  /**
   * Multiply dollar float by an integer quantity with precision cents
   */
  static multiply(unitPrice: number, quantity: number): number {
    const unitCents = this.toCents(unitPrice);
    const totalCents = Math.round(unitCents * quantity);
    return this.toDollars(totalCents);
  }

  /**
   * Calculate percentage discount safely in cents
   * e.g. subtotal $100.00, discount 15% -> $15.00
   */
  static calculatePercentage(baseDollars: number, percent: number): number {
    if (percent <= 0 || baseDollars <= 0) return 0;
    const baseCents = this.toCents(baseDollars);
    const resultCents = Math.round((baseCents * percent) / 100);
    return this.toDollars(resultCents);
  }

  /**
   * Fair penny distribution of total discount across multiple line items
   * Guarantees that the sum of line item discounts equals the total order discount exactly.
   */
  static distributeDiscount(
    lineItemSubtotals: number[],
    totalDiscountDollars: number
  ): number[] {
    const totalDiscountCents = this.toCents(totalDiscountDollars);
    if (totalDiscountCents <= 0 || lineItemSubtotals.length === 0) {
      return lineItemSubtotals.map(() => 0);
    }

    const subtotalCents = lineItemSubtotals.map(s => this.toCents(s));
    const grandSubtotalCents = subtotalCents.reduce((a, b) => a + b, 0);

    if (grandSubtotalCents <= 0) {
      return lineItemSubtotals.map(() => 0);
    }

    // Allocate proportional cents
    let allocatedCents = 0;
    const result: number[] = [];

    for (let i = 0; i < subtotalCents.length; i++) {
      if (i === subtotalCents.length - 1) {
        // Last item absorbs any penny difference to ensure exact match
        const remainder = totalDiscountCents - allocatedCents;
        result.push(this.toDollars(Math.max(0, remainder)));
      } else {
        const itemDiscountCents = Math.round(
          (subtotalCents[i] / grandSubtotalCents) * totalDiscountCents
        );
        allocatedCents += itemDiscountCents;
        result.push(this.toDollars(itemDiscountCents));
      }
    }

    return result;
  }
}
