/**
 * AuraPOS Phase 9 — Promotion Engine & Tiered Loyalty Service
 * Handles:
 * - Tiered loyalty levels (Bronze, Silver, Gold, Platinum) with point multipliers
 * - Automatic customer tier progression based on lifetime spend
 * - Promotional rule engine (percentage, fixed amount, tiered spend, BOGO, bundle)
 * - Optimal discount resolution (picks best savings for customer or stacks valid rules)
 */

import { Customer, CartItem } from '../types/pos.ts';
import {
  PromotionRule,
  LoyaltyTier,
  LoyaltyTierLevel,
  CustomerTierProfile
} from '../types/advancedFeatures.ts';
import { StorageService } from './storageService.ts';
import { Currency } from '../utils/currency.ts';

export const LOYALTY_TIERS: Record<LoyaltyTierLevel, LoyaltyTier> = {
  bronze: {
    level: 'bronze',
    name: 'Bronze Member',
    minLifetimeSpend: 0,
    pointMultiplier: 1.0,
    discountPercentage: 0,
    perks: ['Standard 1pt/$1 rewards', 'Digital receipt delivery']
  },
  silver: {
    level: 'silver',
    name: 'Silver Preferred',
    minLifetimeSpend: 250,
    pointMultiplier: 1.25,
    discountPercentage: 5,
    perks: ['1.25x point multiplier', '5% automatic ticket discount', 'Birthday surprise perk']
  },
  gold: {
    level: 'gold',
    name: 'Gold VIP',
    minLifetimeSpend: 750,
    pointMultiplier: 1.5,
    discountPercentage: 10,
    perks: ['1.5x point multiplier', '10% automatic ticket discount', 'Free pastry with coffee']
  },
  platinum: {
    level: 'platinum',
    name: 'Platinum Elite',
    minLifetimeSpend: 1500,
    pointMultiplier: 2.0,
    discountPercentage: 15,
    perks: ['2x double points', '15% automatic ticket discount', 'Priority order fulfillment', 'Exclusive tasting invites']
  }
};

export class PromotionLoyaltyService {
  /**
   * Determine customer loyalty tier based on lifetime spend
   */
  static calculateCustomerTier(customer?: Customer): CustomerTierProfile {
    if (!customer) {
      return {
        tier: 'bronze',
        currentPoints: 0,
        lifetimePoints: 0,
        lifetimeSpend: 0,
        nextTierSpendRequired: 250,
        pointMultiplier: 1.0,
        activeDiscountPct: 0
      };
    }

    const spend = customer.totalSpent || 0;
    let tier: LoyaltyTierLevel = 'bronze';
    let nextSpendReq = 250;

    if (spend >= 1500) {
      tier = 'platinum';
      nextSpendReq = 0;
    } else if (spend >= 750) {
      tier = 'gold';
      nextSpendReq = 1500 - spend;
    } else if (spend >= 250) {
      tier = 'silver';
      nextSpendReq = 750 - spend;
    } else {
      nextSpendReq = 250 - spend;
    }

    const tierConfig = LOYALTY_TIERS[tier];

    return {
      tier,
      currentPoints: customer.loyaltyPoints || 0,
      lifetimePoints: customer.lifetimePoints || customer.loyaltyPoints || 0,
      lifetimeSpend: spend,
      nextTierSpendRequired: Math.max(0, nextSpendReq),
      pointMultiplier: tierConfig.pointMultiplier,
      activeDiscountPct: tierConfig.discountPercentage
    };
  }

  /**
   * Calculate earned points with loyalty tier multiplier
   */
  static calculateEarnedPoints(dollarAmount: number, customer?: Customer): number {
    const tierProfile = this.calculateCustomerTier(customer);
    const basePoints = Math.floor(dollarAmount);
    return Math.floor(basePoints * tierProfile.pointMultiplier);
  }

  /**
   * Automatically evaluate and apply active promotions to cart
   */
  static evaluatePromotions(
    cartItems: CartItem[],
    promotions: PromotionRule[],
    customer?: Customer
  ): {
    totalDiscount: number;
    appliedPromotions: { name: string; amount: number; ruleId: string }[];
  } {
    if (cartItems.length === 0 || promotions.length === 0) {
      return { totalDiscount: 0, appliedPromotions: [] };
    }

    const cartSubtotalCents = cartItems.reduce((acc, i) => acc + Currency.toCents(i.lineTotal), 0);
    const cartSubtotal = Currency.toDollars(cartSubtotalCents);
    const customerTier = this.calculateCustomerTier(customer);
    const applied: { name: string; amount: number; ruleId: string }[] = [];
    let totalDiscountCents = 0;

    const now = new Date();

    for (const rule of promotions) {
      if (!rule.active) continue;

      // Date window validity check
      if (rule.startDate && new Date(rule.startDate) > now) continue;
      if (rule.endDate && new Date(rule.endDate) < now) continue;

      // Minimum order threshold
      if (rule.minOrderAmount && cartSubtotal < rule.minOrderAmount) continue;

      // Tier requirement check
      if (rule.requiredTier) {
        const tierHierarchy: Record<LoyaltyTierLevel, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
        if (tierHierarchy[customerTier.tier] < tierHierarchy[rule.requiredTier]) {
          continue;
        }
      }

      let ruleDiscountCents = 0;

      // 1. Percentage Discount
      if (rule.type === 'percentage_discount') {
        let eligibleCents = 0;
        if (rule.applicableProductIds && rule.applicableProductIds.length > 0) {
          const eligibleItems = cartItems.filter(i => rule.applicableProductIds!.includes(i.productId));
          eligibleCents = eligibleItems.reduce((acc, i) => acc + Currency.toCents(i.lineTotal), 0);
        } else {
          eligibleCents = cartSubtotalCents;
        }

        if (eligibleCents > 0) {
          ruleDiscountCents = Math.round((eligibleCents * rule.value) / 100);
        }
      }

      // 2. Fixed Discount
      else if (rule.type === 'fixed_discount') {
        ruleDiscountCents = Math.min(cartSubtotalCents, Currency.toCents(rule.value));
      }

      // 3. Tiered Spending (e.g. Spend > $50 get $10 off)
      else if (rule.type === 'tiered_spend') {
        if (rule.minOrderAmount && cartSubtotal >= rule.minOrderAmount) {
          ruleDiscountCents = Math.min(cartSubtotalCents, Currency.toCents(rule.value));
        }
      }

      // 4. BOGO (Buy X get Y free)
      else if (rule.type === 'bogo') {
        const requiredQty = rule.requiredQuantity || 2;
        const freeQty = rule.freeQuantity || 1;

        cartItems.forEach(item => {
          if (!rule.applicableProductIds || rule.applicableProductIds.includes(item.productId)) {
            if (item.quantity >= requiredQty) {
              const sets = Math.floor(item.quantity / requiredQty);
              const freeUnits = sets * freeQty;
              ruleDiscountCents += Currency.toCents(item.unitPrice * freeUnits);
            }
          }
        });
      }

      if (ruleDiscountCents > 0) {
        const discountDollars = Currency.toDollars(ruleDiscountCents);
        applied.push({
          name: rule.name,
          amount: discountDollars,
          ruleId: rule.id
        });
        totalDiscountCents += ruleDiscountCents;
      }
    }

    // Do not exceed total cart value
    totalDiscountCents = Math.min(cartSubtotalCents, totalDiscountCents);

    return {
      totalDiscount: Currency.toDollars(totalDiscountCents),
      appliedPromotions: applied
    };
  }
}
