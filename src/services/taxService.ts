import { TaxConfig } from '../types/pos.ts';
import { StorageService } from './storageService.ts';
import { Currency } from '../utils/currency.ts';

export class TaxService {
  /**
   * Get active tax rate for the store
   */
  static getActiveTaxRate(): number {
    const activeTaxes = StorageService.getTaxConfigs().filter(t => t.active);
    return activeTaxes.length > 0 ? activeTaxes[0].rate : 0.08625;
  }

  /**
   * Calculate tax in integer cents given taxable cents and tax rate
   */
  static calculateTaxCents(taxableCents: number, rate: number): number {
    if (taxableCents <= 0 || rate <= 0) return 0;
    return Math.round(taxableCents * rate);
  }

  /**
   * Calculate tax in dollars safely
   */
  static calculateTax(taxableDollars: number, customRate?: number): { rate: number; taxAmount: number; taxCents: number } {
    const rate = customRate !== undefined ? customRate : this.getActiveTaxRate();
    const taxableCents = Currency.toCents(taxableDollars);
    const taxCents = this.calculateTaxCents(taxableCents, rate);
    return {
      rate,
      taxAmount: Currency.toDollars(taxCents),
      taxCents
    };
  }
}
