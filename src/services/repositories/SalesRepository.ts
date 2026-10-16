import { Sale, SaleItem, PaymentRecord } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { SyncEngine } from '../sync/SyncEngine.ts';

/**
 * AuraPOS Offline-First Sales Repository
 * Conforming to Sections 7, 8, 9, 16:
 * - Local Database is the FIRST write target for Android POS operations
 * - Atomic local transaction writes sale, items, payment, inventory movement, sync event, audit log
 * - Cash sales work 100% offline with zero network dependency
 * - Cloud synchronization happens separately via SyncEngine
 */
export class SalesRepository {
  /**
   * Fetch sales history from local database first
   */
  static async getAll(storeId: string = 'store_aura_main', limit: number = 100): Promise<Sale[]> {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getSales(limit);
        if (res.success && Array.isArray(res.sales) && res.sales.length > 0) {
          return res.sales.map(s => ({
            id: s.id,
            storeId: s.storeId || storeId,
            receiptNumber: s.receiptNumber,
            customerId: s.customerId || undefined,
            employeeId: s.cashierId || 'emp_owner',
            employeeName: 'Cashier',
            items: [],
            subtotal: Number(s.subtotal),
            discountAmount: Number(s.discountTotal || 0),
            taxAmount: Number(s.taxTotal || 0),
            taxRate: 0,
            total: Number(s.total),
            payments: [],
            status: s.status,
            isOffline: Boolean(s.isOffline),
            createdAt: s.createdAt,
            updatedAt: s.updatedAt || s.createdAt
          }));
        }
      } catch (err: any) {
        console.warn('[SalesRepository] Native local fetch notice:', err?.message);
      }
    }

    try {
      const dbSales = await LocalDB.getAll<Sale>('sales');
      if (dbSales && dbSales.length > 0) {
        return dbSales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
      }
    } catch (_) {}

    return StorageService.getSales();
  }

  /**
   * Record new completed sale atomically to local database first (Requirements 7, 8, 9)
   */
  static async recordSale(sale: Sale): Promise<Sale> {
    const saleId = sale.id && sale.id.length === 36 ? sale.id : (sale.id.startsWith('sale_') ? sale.id : crypto.randomUUID());
    const finalSale: Sale = {
      ...sale,
      id: saleId,
      isOffline: !SyncEngine.isOnline()
    };

    // 1. ATOMIC LOCAL WRITE (First target)
    await LocalDB.recordSaleAtomic(finalSale);

    // 2. Update reactive local cache
    const currentSales = StorageService.getSales();
    const updated = [finalSale, ...currentSales.filter(s => s.id !== finalSale.id)];
    StorageService.saveSales(updated);

    // 3. Trigger background sync asynchronously without blocking the sale
    if (SyncEngine.isOnline()) {
      SyncEngine.syncNow().catch(err => {
        console.warn('Background sync cycle warning after sale:', err);
      });
    }

    return finalSale;
  }
}
