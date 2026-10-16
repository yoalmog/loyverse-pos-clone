/**
 * AuraPOS - Inventory Operations Domain Types
 * Conforming to Phase 7:
 * - Suppliers directory & contact records
 * - Purchase Order (PO) workflow & receiving
 * - Physical stock counts / inventory audits with variance calculation
 * - Low-stock alerts and inventory valuation
 */

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  leadTimeDays?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  storeId: string;
  poNumber: string; // e.g. "PO-2026-001"
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  totalAmount: number;
  notes?: string;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockCountItem {
  productId: string;
  productName: string;
  sku: string;
  systemExpectedStock: number;
  countedStock: number;
  varianceUnits: number; // countedStock - systemExpectedStock
  unitCost: number;
  varianceValue: number; // varianceUnits * unitCost
  notes?: string;
}

export interface StockCountSession {
  id: string;
  storeId: string;
  title: string;
  status: 'draft' | 'completed' | 'cancelled';
  items: StockCountItem[];
  totalVarianceUnits: number;
  totalVarianceValue: number;
  conductedBy: string;
  startedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface InventoryValuationSummary {
  totalTrackedProducts: number;
  totalUnitsInStock: number;
  totalRetailValue: number;
  totalCostValue: number;
  potentialGrossProfit: number;
  overallMarginPct: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
}
