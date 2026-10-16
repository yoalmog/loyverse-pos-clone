import { Customer } from '../types/pos.ts';
import { StorageService } from './storageService.ts';
import { Currency } from '../utils/currency.ts';

export class CustomerService {
  /**
   * Get all customers from storage
   */
  static getCustomers(): Customer[] {
    return StorageService.getCustomers();
  }

  /**
   * Find customer by ID
   */
  static getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find(c => c.id === id);
  }

  /**
   * Save customer (add new or update existing)
   */
  static saveCustomer(customer: Customer): Customer {
    const customers = this.getCustomers();
    const idx = customers.findIndex(c => c.id === customer.id);
    if (idx !== -1) {
      customers[idx] = { ...customer, updatedAt: new Date().toISOString() };
    } else {
      customers.unshift(customer);
    }
    StorageService.saveCustomers(customers);
    return customer;
  }

  /**
   * Update customer metrics after a completed sale
   */
  static recordPurchase(customerId: string, saleTotalDollars: number, pointsEarned: number): Customer | null {
    const customers = this.getCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1) return null;

    const current = customers[idx];
    const prevSpentCents = Currency.toCents(current.totalSpent);
    const saleCents = Currency.toCents(saleTotalDollars);
    const newSpentDollars = Currency.toDollars(prevSpentCents + saleCents);

    const updated: Customer = {
      ...current,
      totalSpent: newSpentDollars,
      totalOrders: current.totalOrders + 1,
      loyaltyPoints: current.loyaltyPoints + pointsEarned,
      lifetimePoints: current.lifetimePoints + pointsEarned,
      lastPurchaseDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    customers[idx] = updated;
    StorageService.saveCustomers(customers);
    return updated;
  }
}
