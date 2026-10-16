import { supabase, isSupabaseConfigured } from './supabase/supabaseClient.ts';
import { LocalDB } from './db/localDatabase.ts';
import { StorageService } from './storageService.ts';
import { Currency } from '../utils/currency.ts';
import {
  StoreLocation,
  TerminalDevice,
  MultiStoreOverview,
  StoreMetricItem,
  GlobalInventoryItem,
  StaffMemberManagement,
  CashShiftSummary
} from '../types/backOffice.ts';
import { Product, Category, Sale, Employee } from '../types/pos.ts';

export class BackOfficeService {
  /**
   * Retrieve list of all managed stores across cloud & local storage
   */
  static async getStores(): Promise<StoreLocation[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          // Cache stores to LocalDB
          for (const s of data) {
            await LocalDB.put('stores', s);
          }

          return data.map(s => ({
            id: s.id,
            name: s.name,
            code: s.code || s.id.substring(0, 8),
            address: typeof s.address === 'string' ? s.address : s.address?.street || '',
            city: typeof s.address === 'object' ? s.address?.city : '',
            phone: s.phone || '',
            email: s.email || '',
            currency: s.currency || '$',
            timezone: s.timezone || 'UTC',
            isActive: s.is_active !== false,
            createdAt: s.created_at,
            updatedAt: s.updated_at
          }));
        }
      } catch (e: any) {
        console.warn('[BackOfficeService] Exception querying stores from cloud:', e?.message);
      }
    }

    // LocalDB fallback
    try {
      const localStores = await LocalDB.getAll<any>('stores');
      if (localStores.length > 0) {
        return localStores.map(s => ({
          id: s.id,
          name: s.name || 'Store Location',
          code: s.code || s.id.substring(0, 8),
          address: typeof s.address === 'string' ? s.address : s.address?.street || '',
          city: typeof s.address === 'object' ? s.address?.city : '',
          phone: s.phone || '',
          email: s.email || '',
          currency: s.currency || '$',
          timezone: s.timezone || 'UTC',
          isActive: s.is_active !== false,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        }));
      }
    } catch (_) {}

    // Active local settings default
    const active = StorageService.getSettings();
    return [
      {
        id: active.id || 'store_aura_main',
        name: active.name || 'Flagship Store (Main)',
        code: 'MAIN-01',
        address: active.address || 'Central District',
        city: active.city || 'Downtown',
        phone: active.phone || '+1 555-0100',
        email: active.email || 'main@aurapos.io',
        currency: active.currency || '$',
        timezone: active.timezone || 'America/New_York',
        isActive: true,
        terminalCount: 2,
        staffCount: 4
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'North Branch Express',
        code: 'NORTH-02',
        address: '450 North Boulevard',
        city: 'Northside',
        phone: '+1 555-0102',
        email: 'north@aurapos.io',
        currency: '$',
        timezone: 'America/New_York',
        isActive: true,
        terminalCount: 1,
        staffCount: 2
      }
    ];
  }

  /**
   * Retrieve terminals belonging to a store or all stores
   */
  static async getTerminals(storeId?: string): Promise<TerminalDevice[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('terminals').select('*');
        if (storeId) {
          query = query.eq('store_id', storeId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map(t => ({
            id: t.id,
            storeId: t.store_id,
            name: t.name,
            deviceIdentifier: t.device_identifier || t.device_fingerprint,
            status: t.status || (t.is_active ? 'active' : 'inactive'),
            lastSeenAt: t.last_seen_at || t.updated_at,
            createdAt: t.created_at,
            updatedAt: t.updated_at
          }));
        }
      } catch (e: any) {
        console.warn('[BackOfficeService] Exception querying terminals:', e?.message);
      }
    }

    // Default registered terminal list
    const activeStoreId = storeId || StorageService.getSettings().id || 'store_aura_main';
    return [
      {
        id: 'term_aura_pos_01',
        storeId: activeStoreId,
        name: 'Register #1 (Front Counter)',
        deviceIdentifier: 'POS-SUNMI-T2-01',
        status: 'active',
        lastSeenAt: new Date().toISOString(),
        ipAddress: '192.168.1.101',
        appVersion: 'v2.4.0'
      },
      {
        id: 'term_aura_pos_02',
        storeId: activeStoreId,
        name: 'Register #2 (Bar / Drive-thru)',
        deviceIdentifier: 'POS-SUNMI-V2-02',
        status: 'active',
        lastSeenAt: new Date(Date.now() - 15 * 60000).toISOString(),
        ipAddress: '192.168.1.102',
        appVersion: 'v2.4.0'
      }
    ];
  }

  /**
   * Consolidated Multi-Store Performance Overview (Revenue, Orders, Basket Size)
   */
  static async getMultiStoreOverview(
    dateRange: 'today' | 'yesterday' | '7days' | '30days' | 'all' = '7days',
    selectedStoreId?: string
  ): Promise<MultiStoreOverview> {
    const stores = await this.getStores();
    const allSales = StorageService.getSales();
    const products = StorageService.getProducts();

    // Date filtering
    const now = new Date();
    const filteredSales = allSales.filter(s => {
      const d = new Date(s.createdAt);
      if (dateRange === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (dateRange === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        return d.toDateString() === yest.toDateString();
      } else if (dateRange === '7days') {
        return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30days') {
        return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      return true;
    });

    const storeMetrics: StoreMetricItem[] = stores
      .filter(st => !selectedStoreId || selectedStoreId === 'all' || st.id === selectedStoreId)
      .map(store => {
        const storeSales = filteredSales.filter(
          s => s.storeId === store.id || (!s.storeId && store.id === stores[0].id)
        );

        const grossCents = storeSales.reduce((sum, s) => sum + Currency.toCents(s.subtotal), 0);
        const netCents = storeSales
          .filter(s => s.status !== 'refunded')
          .reduce(
            (sum, s) => sum + Math.max(0, Currency.toCents(s.subtotal) - Currency.toCents(s.discountAmount || 0)),
            0
          );
        const orders = storeSales.length;
        const avgBasket = orders > 0 ? Math.round(netCents / orders) : 0;

        const lowStock = products.filter(
          p => (p.storeId === store.id || !p.storeId) && p.trackInventory && p.stock <= p.lowStockThreshold
        ).length;

        return {
          storeId: store.id,
          storeName: store.name,
          currency: store.currency,
          grossSales: Currency.toDollars(grossCents),
          netSales: Currency.toDollars(netCents),
          orderCount: orders,
          averageBasket: Currency.toDollars(avgBasket),
          activeTerminals: store.terminalCount || 1,
          lowStockCount: lowStock
        };
      });

    const consolidatedGross = storeMetrics.reduce((sum, m) => sum + m.grossSales, 0);
    const consolidatedNet = storeMetrics.reduce((sum, m) => sum + m.netSales, 0);
    const consolidatedOrders = storeMetrics.reduce((sum, m) => sum + m.orderCount, 0);
    const avgBasketConsolidated =
      consolidatedOrders > 0
        ? Currency.toDollars(Math.round(Currency.toCents(consolidatedNet) / consolidatedOrders))
        : 0;

    return {
      totalStores: stores.length,
      activeTerminals: storeMetrics.reduce((sum, m) => sum + m.activeTerminals, 0),
      consolidatedGrossSales: consolidatedGross,
      consolidatedNetSales: consolidatedNet,
      consolidatedOrders: consolidatedOrders,
      averageBasketSize: avgBasketConsolidated,
      storeMetrics
    };
  }

  /**
   * Consolidated Global Inventory across all stores
   */
  static async getGlobalInventory(): Promise<GlobalInventoryItem[]> {
    const stores = await this.getStores();
    const products = StorageService.getProducts();
    const categories = StorageService.getCategories();
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    // Query cloud or local inventory
    let cloudInventory: any[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (!error && Array.isArray(data)) {
          cloudInventory = data;
        }
      } catch (_) {}
    }

    return products.map(prod => {
      const storeStocks = stores.map(st => {
        // Find matching store inventory record
        const invMatch = cloudInventory.find(i => i.store_id === st.id && i.product_id === prod.id);
        const qty = invMatch ? Number(invMatch.quantity) : prod.stock;
        return {
          storeId: st.id,
          storeName: st.name,
          quantity: qty,
          isLowStock: prod.trackInventory && qty <= prod.lowStockThreshold
        };
      });

      const totalStock = storeStocks.reduce((sum, s) => sum + s.quantity, 0);
      const isAnyLow = storeStocks.some(s => s.isLowStock);

      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        categoryName: catMap.get(prod.categoryId) || 'General',
        totalStock,
        lowStockThreshold: prod.lowStockThreshold,
        isLowStock: isAnyLow,
        storeStocks
      };
    });
  }

  /**
   * Staff and user management across stores (RBAC)
   */
  static async getStaffMembers(): Promise<StaffMemberManagement[]> {
    const stores = await this.getStores();
    const storeMap = new Map(stores.map(s => [s.id, s.name]));
    const employees = StorageService.getEmployees();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('user_profiles').select('*');
        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map(u => ({
            id: u.id,
            storeId: u.store_id,
            storeName: storeMap.get(u.store_id) || 'Assigned Store',
            fullName: u.full_name || u.name || 'Staff User',
            email: u.email || '',
            role: (u.role || 'cashier').toLowerCase() as any,
            phone: u.phone || '',
            isActive: u.is_active !== false,
            lastLogin: u.updated_at
          }));
        }
      } catch (_) {}
    }

    return employees.map(emp => ({
      id: emp.id,
      storeId: emp.storeId || stores[0].id,
      storeName: storeMap.get(emp.storeId) || stores[0].name,
      fullName: emp.name,
      email: emp.email,
      role: emp.role,
      phone: emp.phone,
      isActive: emp.active,
      lastLogin: emp.lastLogin
    }));
  }

  /**
   * Cash shift history and discrepancy reports across terminals
   */
  static async getCashShifts(storeId?: string): Promise<CashShiftSummary[]> {
    const stores = await this.getStores();
    const storeMap = new Map(stores.map(s => [s.id, s.name]));

    try {
      const shifts = await LocalDB.getAll<any>('cash_shifts');
      const filtered = storeId && storeId !== 'all' ? shifts.filter(s => s.storeId === storeId) : shifts;

      if (filtered.length > 0) {
        return filtered.map(s => ({
          id: s.id,
          storeId: s.storeId || stores[0].id,
          storeName: storeMap.get(s.storeId) || stores[0].name,
          terminalId: s.terminalId || 'term_aura_pos_01',
          terminalName: s.terminalId ? `Register (${s.terminalId.substring(0, 6)})` : 'Register #1',
          userName: s.userName || 'Shift Cashier',
          openingAmount: Number(s.openingAmount || 0),
          closingAmount: s.closingAmount !== null && s.closingAmount !== undefined ? Number(s.closingAmount) : null,
          expectedAmount: s.expectedAmount !== null && s.expectedAmount !== undefined ? Number(s.expectedAmount) : null,
          difference: s.difference !== null && s.difference !== undefined ? Number(s.difference) : null,
          status: s.status || 'closed',
          openedAt: s.openedAt || new Date().toISOString(),
          closedAt: s.closedAt || null
        }));
      }
    } catch (_) {}

    // Clean demonstration shift record if none recorded yet
    return [
      {
        id: 'shift_aura_demo_01',
        storeId: stores[0].id,
        storeName: stores[0].name,
        terminalId: 'term_aura_pos_01',
        terminalName: 'Register #1 (Front Counter)',
        userName: 'Store Cashier',
        openingAmount: 150.0,
        closingAmount: 720.5,
        expectedAmount: 720.5,
        difference: 0.0,
        status: 'closed',
        openedAt: new Date(Date.now() - 9 * 3600000).toISOString(),
        closedAt: new Date(Date.now() - 1 * 3600000).toISOString()
      }
    ];
  }

  /**
   * Generate CSV export for multi-store performance
   */
  static generateCsvReport(overview: MultiStoreOverview): string {
    const headers = [
      'Store ID',
      'Store Name',
      'Currency',
      'Gross Sales',
      'Net Sales',
      'Order Count',
      'Average Basket',
      'Active Terminals',
      'Low Stock Items'
    ];

    const rows = overview.storeMetrics.map(m => [
      m.storeId,
      `"${m.storeName.replace(/"/g, '""')}"`,
      m.currency,
      m.grossSales.toFixed(2),
      m.netSales.toFixed(2),
      m.orderCount,
      m.averageBasket.toFixed(2),
      m.activeTerminals,
      m.lowStockCount
    ]);

    const totalRow = [
      'ALL_STORES',
      '"Consolidated Total"',
      '$',
      overview.consolidatedGrossSales.toFixed(2),
      overview.consolidatedNetSales.toFixed(2),
      overview.consolidatedOrders,
      overview.averageBasketSize.toFixed(2),
      overview.activeTerminals,
      ''
    ];

    return [headers.join(','), ...rows.map(r => r.join(',')), totalRow.join(',')].join('\n');
  }

  /**
   * Trigger browser file download of CSV report
   */
  static downloadReportCsv(overview: MultiStoreOverview, filename: string = 'aurapos_multistore_report.csv'): void {
    if (typeof window === 'undefined') return;
    const csvContent = this.generateCsvReport(overview);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
