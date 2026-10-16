import { Customer } from '../types/pos.ts';

export class LoyaltyService {
  /**
   * Calculate earned points for a purchase amount.
   * e.g. 1 point per $1 spent
   */
  static calculateEarnedPoints(totalDollars: number, pointsPerDollar: number): number {
    if (totalDollars <= 0 || pointsPerDollar <= 0) return 0;
    return Math.floor(totalDollars * pointsPerDollar);
  }

  /**
   * Calculate points needed to cover a total purchase.
   * e.g. at redemptionRate 0.05 ($1 off per 20 points), $10 total needs 200 points
   */
  static calculatePointsNeeded(totalDollars: number, redemptionRate: number): number {
    if (totalDollars <= 0 || redemptionRate <= 0) return 0;
    return Math.ceil(totalDollars / redemptionRate);
  }

  /**
   * Check if a customer can redeem points for the given dollar amount
   */
  static canRedeem(customer: Customer | null | undefined, totalDollars: number, redemptionRate: number): {
    canRedeem: boolean;
    pointsNeeded: number;
    currentPoints: number;
    difference: number;
  } {
    const pointsNeeded = this.calculatePointsNeeded(totalDollars, redemptionRate);
    const currentPoints = customer?.loyaltyPoints || 0;
    const canRedeem = !!customer && currentPoints >= pointsNeeded;
    return {
      canRedeem,
      pointsNeeded,
      currentPoints,
      difference: Math.max(0, pointsNeeded - currentPoints)
    };
  }

  /**
   * Update customer with earned points
   */
  static awardPoints(customer: Customer, points: number): Customer {
    return {
      ...customer,
      loyaltyPoints: customer.loyaltyPoints + points,
      lifetimePoints: customer.lifetimePoints + points,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Deduct points for reward redemption
   */
  static deductPoints(customer: Customer, points: number): Customer {
    return {
      ...customer,
      loyaltyPoints: Math.max(0, customer.loyaltyPoints - points),
      updatedAt: new Date().toISOString()
    };
  }
}
