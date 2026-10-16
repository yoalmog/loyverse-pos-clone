import { Category } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { SyncRepository } from './SyncRepository.ts';

/**
 * AuraPOS Offline-First Category Repository
 * Conforming to Sections 1, 7, 39:
 * - Load categories from local database first
 * - Preserves sort_order and active status
 * - No network requests required for category browsing
 */
export class CategoryRepository {
  /**
   * Fetch all active categories from local database first
   */
  static async getAll(storeId: string = 'store_aura_main'): Promise<Category[]> {
    // 1. Android Native Room SQLite query
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getCategories();
        if (res.success && Array.isArray(res.categories) && res.categories.length > 0) {
          return res.categories.map(c => ({
            id: c.id,
            storeId: c.storeId || storeId,
            name: c.name,
            iconName: c.icon || 'Package',
            imageUrl: c.imageUrl,
            color: c.color || '#2563EB',
            sortOrder: c.sortOrder || 0,
            active: c.active !== false,
            printerId: c.printerId,
            autoPrintKitchen: c.autoPrintKitchen !== false,
            defaultLocale: 'en'
          }));
        }
      } catch (err: any) {
        console.warn('[CategoryRepository] Native local fetch notice:', err?.message);
      }
    }

    // 2. Browser LocalDB / StorageService (Instant & Offline)
    try {
      const dbCategories = await LocalDB.getAll<Category>('categories');
      if (dbCategories && dbCategories.length > 0) {
        return dbCategories
          .filter(c => c.active !== false)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
    } catch (_) {}

    return StorageService.getCategories();
  }

  /**
   * Insert new category locally first
   */
  static async create(category: Category): Promise<Category> {
    const catId = category.id && category.id.length === 36 ? category.id : crypto.randomUUID();
    const created: Category = {
      ...category,
      id: catId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const current = StorageService.getCategories();
    const updated = [...current, created];
    StorageService.saveCategories(updated);
    await LocalDB.put('categories', created);

    await SyncRepository.recordEvent({
      clientEventId: `event_cat_${catId}`,
      storeId: created.storeId || 'store_aura_main',
      entityType: 'category',
      entityId: catId,
      operation: 'INSERT',
      payload: created
    });

    return created;
  }

  /**
   * Update existing category locally first
   */
  static async update(id: string, partial: Partial<Category>): Promise<Category | null> {
    const current = StorageService.getCategories();
    const idx = current.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const merged: Category = {
      ...current[idx],
      ...partial,
      updatedAt: new Date().toISOString()
    };
    current[idx] = merged;
    StorageService.saveCategories(current);
    await LocalDB.put('categories', merged);

    await SyncRepository.recordEvent({
      clientEventId: `event_cat_upd_${id}_${Date.now()}`,
      storeId: merged.storeId || 'store_aura_main',
      entityType: 'category',
      entityId: id,
      operation: 'UPDATE',
      payload: merged
    });

    return merged;
  }

  /**
   * Soft-delete category locally first
   */
  static async delete(id: string): Promise<boolean> {
    const current = StorageService.getCategories();
    const filtered = current.filter(c => c.id !== id);
    StorageService.saveCategories(filtered);
    await LocalDB.delete('categories', id);

    await SyncRepository.recordEvent({
      clientEventId: `event_cat_del_${id}_${Date.now()}`,
      storeId: 'store_aura_main',
      entityType: 'category',
      entityId: id,
      operation: 'DELETE',
      payload: { id }
    });

    return true;
  }
}
