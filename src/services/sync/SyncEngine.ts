import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { StorageService } from '../storageService.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { SyncErrorClassifier, ClassifiedSyncError } from './SyncErrorClassifier.ts';
import { Product, Category, Customer, Employee, StoreSettings, TaxConfig } from '../../types/pos.ts';

export type SyncConnectionState = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'SYNCING' | 'SYNC_ERROR';

export interface SyncEngineStatus {
  state: SyncConnectionState;
  isOnline: boolean;
  lastSuccessfulSync: string | null;
  lastSyncAttempt: string | null;
  pendingUploads: number;
  pendingDownloads: number;
  failedEventsCount: number;
  currentOperation: string;
  lastError?: ClassifiedSyncError | null;
}

export interface FailedSyncEvent {
  id: string;
  clientEventId: string;
  entityType: string;
  entityId: string;
  operation: string;
  errorMessage?: string;
  attempts: number;
  createdAt: string;
}

/**
 * AuraPOS Centralized Offline-First Synchronization Engine
 * Conforming to Sections 12, 13, 14, 15, 16, 17, 18, 19, 21, 25:
 * - Single source of truth for sync orchestration across the app
 * - Bidirectional synchronization with dependency ordering
 * - Safe idempotency via client_event_id
 * - Sync checkpoints and cursors for incremental downloads
 * - Automatic execution upon network reconnect + manual Sync Now
 * - Real PL/pgSQL RPC integration (sync_pull_changes, sync_process_sale)
 * - Two-way local storage & reactive UI cache synchronization
 * - Tombstone handling and timestamp-based Last-Write-Wins (LWW) conflict resolution
 */
class SyncEngineClass {
  private isRunning = false;
  private isSyncing = false;
  private syncTimer: any = null;
  private lastSuccessfulSync: string | null = null;
  private lastSyncAttempt: string | null = null;
  private lastError: ClassifiedSyncError | null = null;
  private currentOp = 'Idle';
  private listeners = new Set<(status: SyncEngineStatus) => void>();

  constructor() {
    try {
      this.lastSuccessfulSync = typeof localStorage !== 'undefined' ? localStorage.getItem('aurapos_last_sync_success') : null;
    } catch {
      this.lastSuccessfulSync = null;
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Listen to browser network changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkOnline);
      window.addEventListener('offline', this.handleNetworkOffline);
    }

    // Auto-trigger sync if online at startup
    if (this.isOnline()) {
      setTimeout(() => this.syncNow(), 1500);
    }

    // Periodic sync check every 60 seconds when online
    this.syncTimer = setInterval(() => {
      if (this.isOnline() && !this.isSyncing) {
        this.syncNow();
      }
    }, 60000);

    this.notify();
  }

  stop(): void {
    this.isRunning = false;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkOnline);
      window.removeEventListener('offline', this.handleNetworkOffline);
    }
  }

  subscribe(listener: (status: SyncEngineStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach(fn => {
      try { fn(status); } catch (_) {}
    });
  }

  private handleNetworkOnline = (): void => {
    this.notify();
    // Requirement 21: Automatically start synchronization when internet becomes available
    this.syncNow();
  };

  private handleNetworkOffline = (): void => {
    this.notify();
  };

  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  getStatus(): SyncEngineStatus {
    const online = this.isOnline();
    let state: SyncConnectionState = online ? 'ONLINE' : 'OFFLINE';

    if (this.isSyncing) {
      state = 'SYNCING';
    } else if (this.lastError && online) {
      state = 'SYNC_ERROR';
    }

    return {
      state,
      isOnline: online,
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastSyncAttempt: this.lastSyncAttempt,
      pendingUploads: this.getPendingCountSync(),
      pendingDownloads: 0,
      failedEventsCount: 0,
      currentOperation: this.currentOp,
      lastError: this.lastError
    };
  }

  private getPendingCountSync(): number {
    try {
      const q = StorageService.getOfflineQueue();
      return q.filter(item => item.syncStatus !== 'synced').length;
    } catch {
      return 0;
    }
  }

  async getPendingCount(): Promise<number> {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getPendingSyncCount();
        if (res.success) return res.pendingCount;
      } catch (_) {}
    }

    try {
      const events = await LocalDB.getAll<any>('sync_events');
      const pendingDb = events.filter(e => e.status === 'PENDING').length;
      const queue = this.getPendingCountSync();
      return Math.max(pendingDb, queue);
    } catch {
      return this.getPendingCountSync();
    }
  }

  async getFailedEvents(): Promise<FailedSyncEvent[]> {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.localDb.getSyncEvents('FAILED', 50);
        if (res.success && Array.isArray(res.events)) {
          return res.events.map(e => ({
            id: e.id,
            clientEventId: e.clientEventId,
            entityType: e.entityType,
            entityId: e.entityId,
            operation: e.operation,
            errorMessage: e.errorMessage,
            attempts: e.attempts || 0,
            createdAt: e.createdAt
          }));
        }
      } catch (_) {}
    }

    try {
      const events = await LocalDB.getAll<any>('sync_events');
      return events
        .filter(e => e.status === 'FAILED')
        .map(e => ({
          id: e.id,
          clientEventId: e.clientEventId || e.id,
          entityType: e.entityType || 'unknown',
          entityId: e.entityId || '',
          operation: e.operation || 'INSERT',
          errorMessage: e.errorMessage || 'Synchronization error',
          attempts: e.attempts || 1,
          createdAt: e.createdAt || new Date().toISOString()
        }));
    } catch {
      return [];
    }
  }

  async retryFailed(): Promise<{ success: boolean; error?: string }> {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        await NativeBridgeService.localDb.retrySync();
      } catch (_) {}
    }

    try {
      const events = await LocalDB.getAll<any>('sync_events');
      for (const ev of events) {
        if (ev.status === 'FAILED') {
          ev.status = 'PENDING';
          ev.attempts = 0;
          await LocalDB.put('sync_events', ev);
        }
      }
    } catch (_) {}

    return this.syncNow();
  }

  /**
   * Main Bidirectional Synchronization Pipeline
   */
  async syncNow(): Promise<{ success: boolean; uploaded?: number; downloaded?: number; error?: string }> {
    if (this.isSyncing) {
      return { success: false, error: 'Synchronization already in progress' };
    }

    if (!this.isOnline()) {
      this.notify();
      return { success: false, error: 'Cannot sync while offline' };
    }

    this.isSyncing = true;
    this.lastSyncAttempt = new Date().toISOString();
    this.currentOp = 'Preparing synchronization...';
    this.notify();

    let uploadedCount = 0;
    let downloadedCount = 0;

    try {
      // 1. If running on native Android, trigger Android Room native sync engine
      if (NativeBridgeService.isNativeAndroid()) {
        try {
          this.currentOp = 'Triggering native Android sync engine...';
          await NativeBridgeService.localDb.triggerSync();
        } catch (nativeErr: any) {
          console.warn('Native Android sync trigger notice:', nativeErr?.message);
        }
      }

      // 2. If Supabase is configured, execute bidirectional sync with cloud
      if (isSupabaseConfigured && supabase) {
        const storeId = StorageService.getSettings()?.id || 'store_aura_main';

        // A. UPLOAD FLOW: Execute in foreign-key dependency order (Section 14)
        this.currentOp = 'Uploading pending offline changes...';
        this.notify();

        // Step 1: Upload offline customers
        uploadedCount += await this.uploadPendingCustomers(storeId);

        // Step 2: Upload offline sales, sale_items & payments with idempotency & inventory movements
        uploadedCount += await this.uploadPendingSales(storeId);

        // Step 3: Upload offline inventory movements
        uploadedCount += await this.uploadPendingInventoryMovements(storeId);

        // Step 4: Upload offline cash shifts & movements (Step 15)
        uploadedCount += await this.uploadPendingCashShifts(storeId);
        uploadedCount += await this.uploadPendingCashMovements(storeId);

        // B. DOWNLOAD FLOW: Download master data in dependency order using sync cursors (Section 15, 18)
        this.currentOp = 'Downloading master data updates...';
        this.notify();

        // Step 1: Store Settings
        downloadedCount += await this.downloadStoreSettings(storeId);

        // Step 2: Taxes (incremental via cursor)
        downloadedCount += await this.downloadTaxes(storeId);

        // Step 3: Categories & Category Translations (incremental via cursor)
        downloadedCount += await this.downloadCategories(storeId);

        // Step 4: Inventory balances (ledger snapshot to update stock projections)
        downloadedCount += await this.downloadInventory(storeId);

        // Step 5: Products & Variants & Translations (incremental via cursor)
        downloadedCount += await this.downloadProducts(storeId);

        // Step 6: Customers (incremental via cursor)
        downloadedCount += await this.downloadCustomers(storeId);

        // Step 7: Printers (incremental via cursor)
        downloadedCount += await this.downloadPrinters(storeId);

        // Step 8: User Profiles & Roles (incremental via cursor)
        downloadedCount += await this.downloadUserProfiles(storeId);
      }

      // 3. Mark successful sync
      this.lastSuccessfulSync = new Date().toISOString();
      this.lastError = null;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('aurapos_last_sync_success', this.lastSuccessfulSync);
        }
      } catch (_) {}
      this.currentOp = 'Idle';
      this.notify();

      return { success: true, uploaded: uploadedCount, downloaded: downloadedCount };
    } catch (err: any) {
      const classified = SyncErrorClassifier.classify(err);
      this.lastError = classified;
      console.warn(`[SyncEngine] Synchronization cycle error [${classified.type}] (retryable=${classified.retryable}):`, classified.message);
      this.currentOp = `Sync error: ${classified.message}`;
      this.notify();
      return { success: false, error: classified.message };
    } finally {
      this.isSyncing = false;
      this.currentOp = 'Idle';
      this.notify();
    }
  }

  // -------------------------------------------------------------
  // Incremental Cursor Checkpoint Helpers (Section 4 & 5)
  // -------------------------------------------------------------

  private async getCursor(entityType: string, storeId: string): Promise<string | null> {
    try {
      const rec = await LocalDB.getById<any>('sync_cursors', `${storeId}_${entityType}`);
      return rec?.cursor || null;
    } catch {
      return null;
    }
  }

  private async saveCursor(entityType: string, storeId: string, cursor: string): Promise<void> {
    try {
      await LocalDB.put('sync_cursors', {
        id: `${storeId}_${entityType}`,
        storeId,
        entityType,
        cursor,
        updatedAt: new Date().toISOString()
      });
    } catch (_) {}
  }

  /**
   * Dedicated Incremental Pull helper.
   * Invokes the PL/pgSQL sync_pull_changes RPC function first,
   * falling back cleanly to PostgREST queries if unauthenticated or RPC not present.
   */
  private async pullEntityChanges(
    entityType: string,
    storeId: string,
    cursor: string | null
  ): Promise<any[] | null> {
    if (!supabase) return null;

    // 1. Attempt server RPC sync_pull_changes (SECURITY DEFINER with validation)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('sync_pull_changes', {
        p_store_id: storeId,
        p_entity_type: entityType,
        p_cursor: cursor || undefined
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        // PostgREST returns rows; unpack TABLE (data JSONB)
        return rpcData.map((row: any) => (row && typeof row === 'object' && 'data' in row ? row.data : row));
      }
    } catch (_) {
      // Fall through to PostgREST table fallback
    }

    // 2. Direct PostgREST query fallback
    try {
      const targetTable = entityType === 'store_settings' ? 'stores' : entityType;
      let query = supabase.from(targetTable).select('*');
      if (entityType === 'store_settings') {
        query = query.eq('id', storeId);
      } else {
        query = query.eq('store_id', storeId);
      }

      if (cursor) {
        query = query.gt('updated_at', cursor);
      }
      query = query.order('updated_at', { ascending: true });

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (_) {}

    return null;
  }

  // -------------------------------------------------------------
  // Upload Helpers (Enforcing Section 3, 14 & 16 Idempotency)
  // -------------------------------------------------------------

  private async uploadPendingCustomers(storeId: string): Promise<number> {
    if (!supabase) return 0;
    let count = 0;
    try {
      const customers = await LocalDB.getAll<any>('customers');
      const pending = customers.filter(c => c.syncStatus === 'PENDING_UPLOAD' && (c.storeId === storeId || !c.storeId));

      for (const c of pending) {
        const { error } = await supabase.from('customers').upsert({
          id: c.id,
          store_id: c.storeId || storeId,
          name: c.name,
          phone: c.phone || null,
          email: c.email || null,
          address: c.address || null,
          notes: c.notes || null,
          loyalty_points: c.loyaltyPoints || 0,
          total_spent: c.totalSpent || 0,
          total_orders: c.totalOrders || 0,
          is_active: c.active !== false
        }, { onConflict: 'id' });

        if (!error) {
          c.syncStatus = 'SYNCED';
          await LocalDB.put('customers', c);
          count++;
        }
      }
    } catch (_) {}
    return count;
  }

  private async uploadPendingSales(storeId: string): Promise<number> {
    if (!supabase) return 0;
    let count = 0;

    try {
      // 1. Gather pending sales from both StorageService queue and LocalDB
      const queue = StorageService.getOfflineQueue();
      let localSales: any[] = [];
      try {
        localSales = await LocalDB.getAll<any>('sales');
      } catch (_) {}
      const pendingLocalSales = localSales.filter(s => s.syncStatus === 'PENDING_UPLOAD');

      // Deduplicate pending sales by ID
      const salesMap = new Map<string, { sale: any; queueItem: any }>();
      queue.filter(item => item.syncStatus !== 'synced').forEach(item => {
        if (item.sale?.id) salesMap.set(item.sale.id, { sale: item.sale, queueItem: item });
      });
      pendingLocalSales.forEach(s => {
        if (s.id && !salesMap.has(s.id)) {
          salesMap.set(s.id, { sale: s, queueItem: null });
        }
      });

      for (const { sale, queueItem } of Array.from(salesMap.values())) {
        try {
          // Generate inventory movements (deduction) for each tracked line item
          const movements = (sale.items || [])
            .filter((it: any) => it.productId && it.productId.length === 36)
            .map((it: any) => ({
              id: undefined,
              product_id: it.productId,
              type: 'sale',
              quantity: -Math.abs(Number(it.quantity || 1)),
              reference_type: 'SALE',
              reference_id: sale.id,
              created_at: sale.createdAt
            }));

          let uploaded = false;

          // Attempt atomic server RPC sync_process_sale first (Step 13)
          try {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('sync_process_sale', {
              p_sale: {
                id: sale.id && sale.id.length === 36 ? sale.id : undefined,
                store_id: sale.storeId || storeId,
                receipt_number: sale.receiptNumber,
                customer_id: sale.customerId && sale.customerId.length === 36 ? sale.customerId : null,
                cashier_id: null,
                subtotal: sale.subtotal,
                discount_total: sale.discountAmount || 0,
                tax_total: sale.taxAmount || 0,
                total: sale.total,
                currency: '$',
                status: 'completed',
                is_offline: true,
                client_created_at: sale.createdAt
              },
              p_items: (sale.items || []).map((it: any) => ({
                id: it.id && it.id.length === 36 ? it.id : undefined,
                product_id: it.productId && it.productId.length === 36 ? it.productId : null,
                product_name_snapshot: it.productName || 'Item',
                quantity: it.quantity,
                unit_price: it.unitPrice,
                discount: it.discountAmount || 0,
                tax: it.taxAmount || 0,
                total: it.lineTotal,
                created_at: sale.createdAt
              })),
              p_payments: (sale.payments || []).map((p: any) => ({
                id: p.id && p.id.length === 36 ? p.id : undefined,
                method: p.method || 'cash',
                amount: p.amount,
                tendered: p.tendered || null,
                change: p.change || null,
                status: 'completed',
                provider_reference: p.transactionReference || null,
                created_at: p.createdAt || sale.createdAt
              })),
              p_movements: movements,
              p_client_event_id: `sale_event_${sale.id}`
            });

            if (!rpcErr && rpcData?.success) {
              uploaded = true;
            } else if (rpcErr) {
              const classified = SyncErrorClassifier.classify(rpcErr);
              if (classified.type === 'DUPLICATE_EVENT') {
                // Idempotently already on server
                uploaded = true;
              }
            }
          } catch (_) {
            // Fall back to table upserts if RPC not present in environment
          }

          if (!uploaded) {
            // Idempotent upsert of sale using immutable sale UUID (Section 3)
            const { error: saleErr } = await supabase.from('sales').upsert({
              id: sale.id && sale.id.length === 36 ? sale.id : undefined,
              store_id: sale.storeId || storeId,
              receipt_number: sale.receiptNumber,
              customer_id: sale.customerId && sale.customerId.length === 36 ? sale.customerId : null,
              cashier_id: null,
              subtotal: sale.subtotal,
              discount_total: sale.discountAmount || 0,
              tax_total: sale.taxAmount || 0,
              total: sale.total,
              currency: '$',
              status: 'completed',
              is_offline: true,
              client_created_at: sale.createdAt
            }, { onConflict: 'id' });

            if (!saleErr) {
              // Upsert line items idempotently
              if (Array.isArray(sale.items) && sale.items.length > 0) {
                const itemRows = sale.items.map((it: any) => ({
                  id: it.id && it.id.length === 36 ? it.id : undefined,
                  sale_id: sale.id,
                  product_id: it.productId && it.productId.length === 36 ? it.productId : null,
                  product_name_snapshot: it.productName || 'Item',
                  quantity: it.quantity,
                  unit_price: it.unitPrice,
                  discount: it.discountAmount || 0,
                  tax: it.taxAmount || 0,
                  total: it.lineTotal,
                  created_at: sale.createdAt
                }));
                await supabase.from('sale_items').upsert(itemRows, { onConflict: 'id' });
              }

              // Upsert payments idempotently
              if (Array.isArray(sale.payments) && sale.payments.length > 0) {
                const paymentRows = sale.payments.map((p: any) => ({
                  id: p.id && p.id.length === 36 ? p.id : undefined,
                  sale_id: sale.id,
                  method: p.method || 'cash',
                  amount: p.amount,
                  tendered: p.tendered || null,
                  change: p.change || null,
                  status: 'completed',
                  provider_reference: p.transactionReference || null,
                  created_at: p.createdAt || sale.createdAt
                }));
                await supabase.from('payments').upsert(paymentRows, { onConflict: 'id' });
              }

              uploaded = true;
            }
          }

          if (uploaded) {
            count++;
            if (queueItem) {
              queueItem.syncStatus = 'synced';
            }
            // Mark sale as synced in LocalDB
            sale.syncStatus = 'SYNCED';
            await LocalDB.put('sales', sale);

            // Mark matching sync_events and inventory movements as synced
            try {
              const events = await LocalDB.getAll<any>('sync_events');
              for (const ev of events) {
                if (ev.clientEventId === `sale_event_${sale.id}` || ev.entityId === sale.id) {
                  ev.status = 'COMPLETED';
                  await LocalDB.put('sync_events', ev);
                }
              }

              const movementsList = await LocalDB.getAll<any>('inventory_movements');
              for (const m of movementsList) {
                if (m.referenceId === sale.id) {
                  m.syncStatus = 'SYNCED';
                  await LocalDB.put('inventory_movements', m);
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      StorageService.saveOfflineQueue(queue.filter(item => item.syncStatus !== 'synced'));
    } catch (_) {}

    return count;
  }

  private async uploadPendingInventoryMovements(storeId: string): Promise<number> {
    if (!supabase) return 0;
    let count = 0;
    try {
      const movements = await LocalDB.getAll<any>('inventory_movements');
      const pending = movements.filter(m => m.syncStatus === 'PENDING_UPLOAD' && (m.storeId === storeId || !m.storeId));

      for (const m of pending) {
        const { error } = await supabase.from('inventory_movements').upsert({
          id: m.id.length === 36 ? m.id : undefined,
          store_id: m.storeId || storeId,
          product_id: m.productId,
          type: m.type || 'sale',
          quantity: m.quantity,
          reference_type: m.referenceType || 'SALE',
          reference_id: m.referenceId,
          created_at: m.createdAt
        }, { onConflict: 'id' });

        if (!error) {
          m.syncStatus = 'SYNCED';
          await LocalDB.put('inventory_movements', m);
          count++;
        }
      }
    } catch (_) {}
    return count;
  }

  private async uploadPendingCashShifts(storeId: string): Promise<number> {
    if (!supabase) return 0;
    let count = 0;
    try {
      const shifts = await LocalDB.getAll<any>('cash_shifts');
      const pending = shifts.filter(s => s.syncStatus === 'PENDING_UPLOAD' && (s.storeId === storeId || !s.storeId));

      for (const s of pending) {
        const { error } = await supabase.from('cash_shifts').upsert({
          id: s.id && s.id.length === 36 ? s.id : undefined,
          store_id: s.storeId || storeId,
          terminal_id: s.terminalId && s.terminalId.length === 36 ? s.terminalId : null,
          user_id: s.userId && s.userId.length === 36 ? s.userId : null,
          opening_amount: s.openingAmount,
          closing_amount: s.closingAmount !== undefined ? s.closingAmount : null,
          expected_amount: s.expectedAmount !== undefined ? s.expectedAmount : null,
          difference: s.difference !== undefined ? s.difference : null,
          status: s.status || 'open',
          opened_at: s.openedAt,
          closed_at: s.closedAt || null
        }, { onConflict: 'id' });

        if (!error) {
          s.syncStatus = 'SYNCED';
          await LocalDB.put('cash_shifts', s);
          count++;
        }
      }
    } catch (_) {}
    return count;
  }

  private async uploadPendingCashMovements(storeId: string): Promise<number> {
    if (!supabase) return 0;
    let count = 0;
    try {
      const moves = await LocalDB.getAll<any>('cash_movements');
      const pending = moves.filter(m => m.syncStatus === 'PENDING_UPLOAD');

      for (const m of pending) {
        const { error } = await supabase.from('cash_movements').upsert({
          id: m.id && m.id.length === 36 ? m.id : undefined,
          shift_id: m.shiftId,
          type: m.type,
          amount: m.amount,
          reason: m.reason || null,
          user_id: m.userId && m.userId.length === 36 ? m.userId : null,
          created_at: m.createdAt
        }, { onConflict: 'id' });

        if (!error) {
          m.syncStatus = 'SYNCED';
          await LocalDB.put('cash_movements', m);
          count++;
        }
      }
    } catch (_) {}
    return count;
  }

  // -------------------------------------------------------------
  // Incremental Download Helpers (Sections 4, 5, 15, 18)
  // -------------------------------------------------------------

  private async downloadCategories(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('categories', storeId);
      const data = await this.pullEntityChanges('categories', storeId, cursor);

      if (Array.isArray(data) && data.length > 0) {
        const currentCats = StorageService.getCategories();
        const catMap = new Map<string, Category>();
        currentCats.forEach(c => catMap.set(c.id, c));

        for (const cat of data) {
          const isDeleted = Boolean(cat.deleted_at || cat.is_active === false);
          const existing = catMap.get(cat.id);

          // Timestamp-based Last-Write-Wins (LWW) conflict resolution
          if (existing && (existing as any).syncStatus === 'PENDING_UPLOAD' && existing.updatedAt && cat.updated_at) {
            if (new Date(existing.updatedAt).getTime() > new Date(cat.updated_at).getTime()) {
              continue;
            }
          }

          const catRecord: Category = {
            id: cat.id,
            storeId: cat.store_id,
            name: cat.name || cat.icon,
            iconName: cat.icon || 'Package',
            color: cat.color || '#2563EB',
            sortOrder: cat.sort_order || 0,
            active: !isDeleted,
            updatedAt: cat.updated_at
          };

          await LocalDB.put('categories', { ...catRecord, isDeleted, syncStatus: 'SYNCED' });
          catMap.set(cat.id, catRecord);
        }

        // Mirror directly to StorageService so UI immediately reflects cloud master data
        StorageService.saveCategories(Array.from(catMap.values()));

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('categories', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }

  /**
   * Syncs actual stock quantities from the cloud inventory ledger table
   * into local database and updates reactive product stock models.
   */
  private async downloadInventory(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('inventory', storeId);
      let query = supabase
        .from('inventory')
        .select('*')
        .eq('store_id', storeId)
        .order('updated_at', { ascending: true });

      if (cursor) {
        query = query.gt('updated_at', cursor);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const invMap = new Map<string, number>();

        for (const inv of data) {
          const qty = Number(inv.quantity);
          invMap.set(inv.product_id, qty);
          await LocalDB.put('inventory', {
            id: inv.id || `${inv.store_id}_${inv.product_id}`,
            storeId: inv.store_id,
            productId: inv.product_id,
            quantity: qty,
            updatedAt: inv.updated_at
          });
        }

        // Mirror stock quantities into current StorageService products
        const currentProducts = StorageService.getProducts();
        let updatedCount = 0;
        const updatedProducts = currentProducts.map(p => {
          if (invMap.has(p.id)) {
            updatedCount++;
            return {
              ...p,
              stock: invMap.get(p.id)!,
              updatedAt: new Date().toISOString()
            };
          }
          return p;
        });

        if (updatedCount > 0) {
          StorageService.saveProducts(updatedProducts);
        }

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('inventory', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }

  private async downloadProducts(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('products', storeId);
      const data = await this.pullEntityChanges('products', storeId, cursor);

      if (Array.isArray(data) && data.length > 0) {
        const currentProducts = StorageService.getProducts();
        const productMap = new Map<string, Product>();
        currentProducts.forEach(p => productMap.set(p.id, p));

        for (const p of data) {
          const isDeleted = Boolean(p.deleted_at || p.is_active === false);
          const existing = productMap.get(p.id);

          // Timestamp-based Last-Write-Wins (LWW) conflict resolution
          if (existing && (existing as any).syncStatus === 'PENDING_UPLOAD' && existing.updatedAt && p.updated_at) {
            if (new Date(existing.updatedAt).getTime() > new Date(p.updated_at).getTime()) {
              // Local change is newer; keep local version pending
              continue;
            }
          }

          // Resolve accurate stock quantity from inventory store or local cache
          let stockQty = existing ? existing.stock : Number(p.stock_minimum || 0);
          try {
            const invRec = await LocalDB.getById<any>('inventory', `${storeId}_${p.id}`);
            if (invRec && invRec.quantity !== undefined) {
              stockQty = Number(invRec.quantity);
            }
          } catch (_) {}

          const productRecord: Product = {
            id: p.id,
            storeId: p.store_id,
            categoryId: p.category_id || '',
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            description: p.description || '',
            price: Number(p.price),
            cost: Number(p.cost || 0),
            unit: p.unit || 'item',
            trackInventory: Boolean(p.track_inventory),
            stock: stockQty,
            lowStockThreshold: Number(p.stock_minimum || 10),
            active: !isDeleted,
            isFavorite: Boolean(p.is_favorite),
            imageUrl: p.image_url,
            createdAt: p.created_at,
            updatedAt: p.updated_at
          };

          await LocalDB.put('products', { ...productRecord, isDeleted, syncStatus: 'SYNCED' });
          productMap.set(p.id, productRecord);
        }

        // Mirror directly to StorageService so UI immediately reflects cloud master data
        StorageService.saveProducts(Array.from(productMap.values()));

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('products', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }

  private async downloadTaxes(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('taxes', storeId);
      const data = await this.pullEntityChanges('taxes', storeId, cursor);

      if (Array.isArray(data) && data.length > 0) {
        for (const t of data) {
          await LocalDB.put('taxes', t);
        }

        const taxConfigs: TaxConfig[] = data.map(t => ({
          id: t.id,
          storeId: t.store_id || storeId,
          name: t.name,
          rate: Number(t.rate),
          inclusive: Boolean(t.is_inclusive),
          active: Boolean(t.is_active)
        }));
        StorageService.saveTaxConfigs(taxConfigs);

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('taxes', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }

  private async downloadCustomers(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('customers', storeId);
      const data = await this.pullEntityChanges('customers', storeId, cursor);

      if (Array.isArray(data) && data.length > 0) {
        const currentCusts = StorageService.getCustomers();
        const custMap = new Map<string, Customer>();
        currentCusts.forEach(c => custMap.set(c.id, c));

        for (const c of data) {
          const rawName: string = c.name || '';
          const nameParts = rawName.split(' ');
          const custRecord: Customer = {
            id: c.id,
            storeId: c.store_id,
            firstName: c.first_name || (nameParts[0] || 'Customer'),
            lastName: c.last_name || (nameParts.slice(1).join(' ') || ''),
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || '',
            notes: c.notes || '',
            loyaltyPoints: c.loyalty_points || 0,
            lifetimePoints: c.loyalty_points || 0,
            totalSpent: Number(c.total_spent || 0),
            totalOrders: c.total_orders || 0,
            createdAt: c.created_at,
            updatedAt: c.updated_at
          };

          await LocalDB.put('customers', { ...custRecord, active: c.is_active !== false, syncStatus: 'SYNCED' });
          custMap.set(c.id, custRecord);
        }

        StorageService.saveCustomers(Array.from(custMap.values()));

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('customers', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }

  private async downloadPrinters(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('printers', storeId);
      const data = await this.pullEntityChanges('printers', storeId, cursor);

      if (Array.isArray(data) && data.length > 0) {
        for (const pr of data) {
          await LocalDB.put('printers', pr);
        }

        const printersList: any[] = data.map(pr => ({
          id: pr.id,
          name: pr.name,
          type: pr.type || 'network',
          ipAddress: pr.ip_address,
          port: pr.port || 9100,
          macAddress: pr.mac_address,
          bluetoothName: pr.bluetooth_name,
          usbVendorId: pr.usb_vendor_id,
          usbProductId: pr.usb_product_id,
          paperWidth: pr.paper_width || 80,
          characterSet: pr.character_set || 'PC437_USA',
          status: 'online',
          isDefault: Boolean(pr.is_default),
          role: pr.role || 'RECEIPT',
          createdAt: pr.created_at,
          updatedAt: pr.updated_at
        }));
        StorageService.savePrinters(printersList);

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('printers', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }

  private async downloadStoreSettings(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const data = await this.pullEntityChanges('store_settings', storeId, null);
      const storeRecord = Array.isArray(data) && data.length > 0 ? data[0] : null;

      if (storeRecord) {
        await LocalDB.put('stores', storeRecord);
        const currentSettings = StorageService.getSettings();
        StorageService.saveSettings({
          ...currentSettings,
          id: storeRecord.id,
          name: storeRecord.name || currentSettings.name,
          phone: storeRecord.phone || currentSettings.phone,
          address: storeRecord.address || currentSettings.address,
          currency: storeRecord.currency || currentSettings.currency
        });
        return 1;
      }
    } catch (_) {}
    return 0;
  }

  private async downloadUserProfiles(storeId: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const cursor = await this.getCursor('user_profiles', storeId);
      const data = await this.pullEntityChanges('user_profiles', storeId, cursor);

      if (Array.isArray(data) && data.length > 0) {
        for (const u of data) {
          await LocalDB.put('user_profiles', u);
        }

        const currentEmployees = StorageService.getEmployees();
        const empMap = new Map<string, Employee>();
        currentEmployees.forEach(e => empMap.set(e.id, e));

        data.forEach(u => {
          empMap.set(u.id, {
            id: u.id,
            storeId: u.store_id || storeId,
            name: u.full_name || u.name || 'Staff Member',
            email: u.email || '',
            phone: u.phone || '',
            role: (u.role || 'CASHIER').toLowerCase() as any,
            pin: u.pin || '1234',
            active: u.is_active !== false,
            permissions: []
          });
        });

        StorageService.saveEmployees(Array.from(empMap.values()));

        const latest = data[data.length - 1].updated_at;
        if (latest) await this.saveCursor('user_profiles', storeId, latest);
        return data.length;
      }
    } catch (_) {}
    return 0;
  }
}

export const SyncEngine = new SyncEngineClass();
// Auto-start SyncEngine in browser / WebView runtime
if (typeof window !== 'undefined') {
  SyncEngine.start();
}
