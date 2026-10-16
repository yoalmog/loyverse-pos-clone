import { Product, ProductVariant } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { SyncRepository } from './SyncRepository.ts';

export interface BarcodeLookupResult {
  product: Product;
  matchedVariant?: ProductVariant;
  matchType: 'product_barcode' | 'product_sku' | 'variant_barcode' | 'variant_sku';
}

/**
 * AuraPOS Offline-First Product Repository
 * Conforming to Sections 1, 7, 37, 38, 53:
 * - Local database is the primary operational source for the POS
 * - Zero network requests during product browsing, search, and barcode scanning
 * - Instant barcode lookup in airplane mode
 */
export class ProductRepository {
  /**
   * Fetch all active products from local database first
   */
  static async getAll(storeId: string = 'store_aura_main'): Promise<Product[]> {
    // 1. Android Native Room SQLite query
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getProducts();
        if (res.success && Array.isArray(res.products) && res.products.length > 0) {
          return res.products.map(p => ({
            id: p.id,
            storeId: p.storeId || storeId,
            categoryId: p.categoryId || '',
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            description: p.description || '',
            price: Number(p.price),
            cost: Number(p.cost || 0),
            unit: p.unit || 'item',
            trackInventory: p.trackInventory !== false,
            stock: Number(p.stock || 0),
            lowStockThreshold: Number(p.lowStockThreshold || 0),
            active: p.active !== false,
            isFavorite: Boolean(p.isFavorite),
            imageUrl: p.imageUrl || undefined,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt
          }));
        }
      } catch (err: any) {
        console.warn('[ProductRepository] Native local fetch notice:', err?.message);
      }
    }

    // 2. Browser LocalDB / StorageService (Instant & Offline)
    try {
      const dbProducts = await LocalDB.getAll<Product>('products');
      if (dbProducts && dbProducts.length > 0) {
        return dbProducts.filter(p => p.active !== false);
      }
    } catch (_) {}

    return StorageService.getProducts();
  }

  /**
   * Instant local product search without network calls (Section 38)
   */
  static async search(query: string, storeId: string = 'store_aura_main'): Promise<Product[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll(storeId);

    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getProducts(q);
        if (res.success && Array.isArray(res.products)) {
          return res.products;
        }
      } catch (_) {}
    }

    const all = await this.getAll(storeId);
    return all.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }

  /**
   * Barcode search: Scanner -> Local ProductRepository -> Product -> Cart (Section 37)
   */
  static async getByBarcode(barcode: string, storeId: string = 'store_aura_main'): Promise<Product | null> {
    const result = await this.lookupBarcode(barcode, storeId);
    return result ? result.product : null;
  }

  /**
   * Detailed barcode and SKU lookup resolving both root products and specific variant matches
   */
  static async lookupBarcode(barcode: string, storeId: string = 'store_aura_main'): Promise<BarcodeLookupResult | null> {
    const code = barcode.trim();
    if (!code) return null;

    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getProductByBarcode(code);
        if (res.success && res.product) {
          return { product: res.product, matchType: 'product_barcode' };
        }
      } catch (_) {}
    }

    const all = await this.getAll(storeId);
    for (const p of all) {
      if (p.barcode && p.barcode.trim() === code) {
        return { product: p, matchType: 'product_barcode' };
      }
      if (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase()) {
        return { product: p, matchType: 'product_sku' };
      }
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (v.barcode && v.barcode.trim() === code) {
            return { product: p, matchedVariant: v, matchType: 'variant_barcode' };
          }
          if (v.sku && v.sku.trim().toLowerCase() === code.toLowerCase()) {
            return { product: p, matchedVariant: v, matchType: 'variant_sku' };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get single product by ID from local database
   */
  static async getById(id: string): Promise<Product | null> {
    const products = await this.getAll();
    return products.find(p => p.id === id) || null;
  }

  /**
   * Insert new product locally first (Section 7)
   */
  static async create(product: Product): Promise<Product> {
    const nowIso = new Date().toISOString();
    const prodId = product.id && product.id.length === 36 ? product.id : crypto.randomUUID();

    const createdProduct: Product = {
      ...product,
      id: prodId,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 1. Write to local database
    const current = StorageService.getProducts();
    const updated = [createdProduct, ...current.filter(p => p.id !== prodId)];
    StorageService.saveProducts(updated);
    await LocalDB.put('products', createdProduct);

    // 2. Enqueue sync event
    await SyncRepository.recordEvent({
      clientEventId: `event_prod_${prodId}`,
      storeId: createdProduct.storeId || 'store_aura_main',
      entityType: 'product',
      entityId: prodId,
      operation: 'INSERT',
      payload: createdProduct
    });

    return createdProduct;
  }

  /**
   * Update existing product locally first
   */
  static async update(id: string, partial: Partial<Product>): Promise<Product | null> {
    const current = StorageService.getProducts();
    const idx = current.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const merged: Product = {
      ...current[idx],
      ...partial,
      updatedAt: new Date().toISOString()
    };
    current[idx] = merged;
    StorageService.saveProducts(current);
    await LocalDB.put('products', merged);

    // Enqueue sync event
    await SyncRepository.recordEvent({
      clientEventId: `event_prod_upd_${id}_${Date.now()}`,
      storeId: merged.storeId || 'store_aura_main',
      entityType: 'product',
      entityId: id,
      operation: 'UPDATE',
      payload: merged
    });

    return merged;
  }

  /**
   * Soft-delete product locally first
   */
  static async delete(id: string): Promise<boolean> {
    const current = StorageService.getProducts();
    const filtered = current.filter(p => p.id !== id);
    StorageService.saveProducts(filtered);
    await LocalDB.delete('products', id);

    await SyncRepository.recordEvent({
      clientEventId: `event_prod_del_${id}_${Date.now()}`,
      storeId: 'store_aura_main',
      entityType: 'product',
      entityId: id,
      operation: 'DELETE',
      payload: { id }
    });

    return true;
  }
}
