import { InventoryMovement } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { SyncRepository } from './SyncRepository.ts';

/**
 * AuraPOS Offline-First Inventory Repository
 * Conforming to Sections 10 & 11:
 * - Inventory is movement-based (ledger model)
 * - Local inventory projections update immediately without waiting for network
 * - Multi-terminal reconciliation uses movements over blind quantity overwrites
 */
export class InventoryRepository {
  /**
   * Get all inventory movements from local ledger
   */
  static async getMovements(storeId: string = 'store_aura_main'): Promise<InventoryMovement[]> {
    try {
      const dbMovements = await LocalDB.getAll<any>('inventory_movements');
      if (dbMovements && dbMovements.length > 0) {
        return dbMovements.map(m => ({
          id: m.id,
          storeId: m.storeId || storeId,
          productId: m.productId,
          productName: m.productName || '',
          sku: m.sku || '',
          type: m.type,
          quantity: Number(m.quantity),
          previousQuantity: 0,
          newQuantity: 0,
          reason: m.notes || m.reason || '',
          referenceId: m.referenceId || undefined,
          employeeId: m.userId || 'emp_owner',
          employeeName: 'Staff',
          createdAt: m.createdAt
        }));
      }
    } catch (_) {}

    return StorageService.getInventoryMovements();
  }

  /**
   * Record movement-based stock adjustment locally first (Section 10)
   */
  static async recordMovement(movement: InventoryMovement): Promise<InventoryMovement> {
    const moveId = movement.id && movement.id.length === 36 ? movement.id : crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const finalMovement: InventoryMovement = {
      ...movement,
      id: moveId,
      createdAt: movement.createdAt || nowIso
    };

    // 1. Save to local movements ledger
    await LocalDB.put('inventory_movements', {
      id: moveId,
      storeId: finalMovement.storeId || 'store_aura_main',
      productId: finalMovement.productId,
      type: finalMovement.type,
      quantity: finalMovement.quantity,
      referenceType: finalMovement.type === 'sale' ? 'SALE' : 'MANUAL',
      referenceId: finalMovement.referenceId || null,
      notes: finalMovement.reason || null,
      createdAt: nowIso,
      syncStatus: 'PENDING_UPLOAD'
    });

    const current = StorageService.getInventoryMovements();
    StorageService.saveInventoryMovements([finalMovement, ...current]);

    // 2. Enqueue sync event
    await SyncRepository.recordEvent({
      clientEventId: `event_inv_${moveId}`,
      storeId: finalMovement.storeId || 'store_aura_main',
      entityType: 'inventory_movement',
      entityId: moveId,
      operation: 'INSERT',
      payload: finalMovement
    });

    return finalMovement;
  }
}
