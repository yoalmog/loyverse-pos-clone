import { Customer } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { SyncRepository } from './SyncRepository.ts';

/**
 * AuraPOS Offline-First Customer Repository
 * Conforming to Sections 1, 7, 40:
 * - Customer search operates locally from local database
 * - If created offline, saves locally first with UUID and enqueues sync event
 */
export class CustomerRepository {
  /**
   * Fetch all active customers from local database first
   */
  static async getAll(storeId: string = 'store_aura_main'): Promise<Customer[]> {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getCustomers();
        if (res.success && Array.isArray(res.customers) && res.customers.length > 0) {
          return res.customers.map(c => {
            const parts = (c.name || '').split(' ');
            return {
              id: c.id,
              storeId: c.storeId || storeId,
              firstName: parts[0] || '',
              lastName: parts.slice(1).join(' ') || '',
              phone: c.phone || '',
              email: c.email || '',
              address: c.address || '',
              notes: c.notes || '',
              loyaltyPoints: c.loyaltyPoints || 0,
              lifetimePoints: c.lifetimePoints || 0,
              totalSpent: Number(c.totalSpent || 0),
              totalOrders: c.totalOrders || 0,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt
            };
          });
        }
      } catch (err: any) {
        console.warn('[CustomerRepository] Native local fetch notice:', err?.message);
      }
    }

    try {
      const dbCust = await LocalDB.getAll<Customer>('customers');
      if (dbCust && dbCust.length > 0) {
        return dbCust;
      }
    } catch (_) {}

    return StorageService.getCustomers();
  }

  /**
   * Local customer search (Section 40)
   */
  static async search(query: string, storeId: string = 'store_aura_main'): Promise<Customer[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll(storeId);

    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getCustomers(q);
        if (res.success && Array.isArray(res.customers)) {
          return res.customers.map(c => {
            const parts = (c.name || '').split(' ');
            return {
              id: c.id,
              storeId: c.storeId || storeId,
              firstName: parts[0] || '',
              lastName: parts.slice(1).join(' ') || '',
              phone: c.phone || '',
              email: c.email || '',
              address: c.address || '',
              notes: c.notes || '',
              loyaltyPoints: c.loyaltyPoints || 0,
              lifetimePoints: c.lifetimePoints || 0,
              totalSpent: Number(c.totalSpent || 0),
              totalOrders: c.totalOrders || 0,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt
            };
          });
        }
      } catch (_) {}
    }

    const all = await this.getAll(storeId);
    return all.filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }

  /**
   * Create or save customer locally first (Section 7 & 40)
   */
  static async save(customer: Customer): Promise<Customer> {
    const custId = customer.id && customer.id.length === 36 ? customer.id : crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const fullName = `${customer.firstName} ${customer.lastName}`.trim();

    const saved: Customer = {
      ...customer,
      id: custId,
      createdAt: customer.createdAt || nowIso,
      updatedAt: nowIso
    };

    // 1. Android Native delegation if available
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        await NativeBridgeService.localDb.saveCustomer({
          id: custId,
          storeId: saved.storeId || 'store_aura_main',
          name: fullName,
          phone: saved.phone,
          email: saved.email,
          address: saved.address,
          notes: saved.notes,
          loyaltyPoints: saved.loyaltyPoints,
          lifetimePoints: saved.lifetimePoints,
          totalSpent: saved.totalSpent,
          totalOrders: saved.totalOrders
        });
      } catch (_) {}
    }

    // 2. Local persistence in LocalDB & StorageService
    const current = StorageService.getCustomers();
    const idx = current.findIndex(c => c.id === custId);
    if (idx !== -1) {
      current[idx] = saved;
    } else {
      current.unshift(saved);
    }
    StorageService.saveCustomers(current);
    await LocalDB.put('customers', {
      ...saved,
      name: fullName,
      syncStatus: 'PENDING_UPLOAD'
    });

    // 3. Enqueue sync event
    await SyncRepository.recordEvent({
      clientEventId: `event_cust_${custId}_${Date.now()}`,
      storeId: saved.storeId || 'store_aura_main',
      entityType: 'customer',
      entityId: custId,
      operation: idx !== -1 ? 'UPDATE' : 'INSERT',
      payload: saved
    });

    return saved;
  }
}
