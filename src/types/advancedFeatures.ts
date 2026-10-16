/**
 * AuraPOS Phase 9 — Advanced & Multi-Store Domain Types
 * Covers:
 * 1. Multi-branch stock transfers and catalog distribution
 * 2. Granular RBAC permissions and employee audit trail
 * 3. Promotions engine & tiered loyalty membership
 * 4. External webhooks and General Ledger accounting exports
 */

export type StockTransferStatus = 'draft' | 'pending' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string; // e.g. "TRF-2026-001"
  sourceStoreId: string;
  sourceStoreName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  status: StockTransferStatus;
  items: StockTransferItem[];
  totalUnits: number;
  totalCostValue: number;
  notes?: string;
  shippedBy?: string;
  shippedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type GranularPermission =
  | 'pos:checkout'
  | 'pos:apply_discount'
  | 'pos:issue_refund'
  | 'pos:price_override'
  | 'pos:reprint_receipt'
  | 'inventory:view'
  | 'inventory:adjust'
  | 'inventory:counts'
  | 'inventory:purchase_orders'
  | 'inventory:transfers'
  | 'reports:daily_sales'
  | 'reports:financial_summary'
  | 'reports:export_csv'
  | 'reports:z_report'
  | 'settings:store_profile'
  | 'settings:printers'
  | 'settings:backup_restore'
  | 'staff:view'
  | 'staff:manage_pins'
  | 'staff:audit_logs'
  | '*';

export interface RoleTemplate {
  role: string;
  name: string;
  description: string;
  defaultPermissions: GranularPermission[];
}

export type EmployeeAuditAction =
  | 'pin_updated'
  | 'role_changed'
  | 'permissions_overridden'
  | 'shift_opened'
  | 'shift_closed'
  | 'refund_authorized'
  | 'discount_authorized'
  | 'login_attempt';

export interface EmployeeAuditLog {
  id: string;
  employeeId: string;
  employeeName: string;
  performedById: string;
  performedByName: string;
  action: EmployeeAuditAction;
  details: string;
  timestamp: string;
}

export type PromotionType =
  | 'percentage_discount'
  | 'percentage'
  | 'fixed_discount'
  | 'fixed_amount'
  | 'bogo'
  | 'bundle'
  | 'tiered_spend';

export interface PromotionRule {
  id: string;
  name: string;
  code?: string;
  type: PromotionType;
  value: number; // e.g., 20 for 20% off, 5.00 for $5 off
  minOrderAmount?: number;
  minSpend?: number; // Compatibility alias for minOrderAmount
  requiredQuantity?: number;
  freeQuantity?: number;
  applicableProductIds?: string[];
  applicableCategoryIds?: string[];
  requiredTier?: LoyaltyTierLevel;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export type LoyaltyTierLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTier {
  level: LoyaltyTierLevel;
  name: string;
  minLifetimeSpend: number;
  pointMultiplier: number;
  discountPercentage: number;
  perks: string[];
}

export interface CustomerTierProfile {
  tier: LoyaltyTierLevel;
  currentPoints: number;
  lifetimePoints: number;
  lifetimeSpend: number;
  nextTierSpendRequired: number;
  pointMultiplier: number;
  activeDiscountPct: number;
}

export type WebhookEventType =
  | 'sale.completed'
  | 'sale.refunded'
  | 'inventory.low_stock'
  | 'inventory.transfer_completed'
  | 'shift.closed';

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  targetUrl?: string; // Compatibility alias for url
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  subscriptionId: string;
  url: string;
  event: WebhookEventType;
  signature: string;
  payload: any;
  statusCode?: number;
  success: boolean;
  attempts: number;
  timestamp: string;
}

export type GeneralLedgerAccount =
  | '1010_CASH_DRAWER'
  | '1020_CARD_CLEARING'
  | '1030_DIGITAL_WALLET_CLEARING'
  | '1200_INVENTORY_ASSET'
  | '2100_SALES_TAX_PAYABLE'
  | '4010_SALES_REVENUE'
  | '4020_DISCOUNTS_EXPENSE'
  | '5010_COGS_EXPENSE';

export interface GeneralLedgerJournalEntry {
  id: string;
  entryNumber?: string; // Compatibility alias for id
  date: string;
  reference: string;
  account: GeneralLedgerAccount;
  accountCode?: string; // Compatibility alias for account
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

export interface GeneralLedgerReport {
  generatedAt: string;
  startDate: string;
  endDate: string;
  entries: GeneralLedgerJournalEntry[];
  totalDebit: number;
  totalCredit: number;
  totalDebits?: number; // Compatibility alias for totalDebit
  totalCredits?: number; // Compatibility alias for totalCredit
  isBalanced: boolean;
}
