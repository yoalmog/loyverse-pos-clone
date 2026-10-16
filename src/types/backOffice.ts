/**
 * AuraPOS Phase 5 — Cloud Back Office & Multi-Store Domain Types
 */

export interface StoreLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  terminalCount?: number;
  staffCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TerminalDevice {
  id: string;
  storeId: string;
  name: string;
  deviceIdentifier?: string;
  status: 'active' | 'inactive' | 'maintenance';
  lastSeenAt?: string | null;
  ipAddress?: string;
  appVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreMetricItem {
  storeId: string;
  storeName: string;
  currency: string;
  grossSales: number;
  netSales: number;
  orderCount: number;
  averageBasket: number;
  activeTerminals: number;
  lowStockCount: number;
}

export interface MultiStoreOverview {
  totalStores: number;
  activeTerminals: number;
  consolidatedGrossSales: number;
  consolidatedNetSales: number;
  consolidatedOrders: number;
  averageBasketSize: number;
  storeMetrics: StoreMetricItem[];
}

export interface GlobalInventoryItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  categoryName: string;
  totalStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  storeStocks: Array<{
    storeId: string;
    storeName: string;
    quantity: number;
    isLowStock: boolean;
  }>;
}

export interface StaffMemberManagement {
  id: string;
  storeId: string;
  storeName: string;
  fullName: string;
  email: string;
  role: import('./pos.ts').EmployeeRole;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
}

export interface CashShiftSummary {
  id: string;
  storeId: string;
  storeName: string;
  terminalId: string;
  terminalName: string;
  userName: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
}
