import {
  Category,
  Product,
  Customer,
  Employee,
  Sale,
  Discount,
  TaxConfig,
  StoreSettings,
  InventoryMovement
} from '../types/pos.ts';

// Clean production store defaults (Zero fake data)
export const INITIAL_STORE_SETTINGS: StoreSettings = {
  id: 'store_aura_main',
  name: 'Store Register',
  logoUrl: '',
  themeColor: 'emerald',
  themeMode: 'light',
  themePalette: 'emerald',
  themeBackgroundStyle: 'soft-tint',
  themePattern: 'none',
  language: 'en',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  phone: '',
  email: '',
  website: '',
  taxId: '',
  currency: '$',
  timezone: 'UTC',
  receiptHeader: '',
  receiptFooter: 'Thank you for your purchase!',
  showCashier: true,
  showCustomer: true,
  showBarcode: true,
  showLoyalty: true,
  showTaxBreakdown: true,
  showLoyaltyPoints: true,
  showStoreLogo: true,
  showReturnPolicy: true,
  returnPolicyText: 'Items in original condition may be returned or exchanged within 30 days with receipt.',
  showReceiptQrCode: true,
  receiptQrType: 'both',
  feedbackSurveyUrl: 'https://aurapos.app/feedback',
  receiptPrefix: 'REC-',
  nextReceiptNumber: 1001,
  pointsPerDollar: 1,
  redemptionRate: 0.05,
  allowNegativeStock: false,
  autoPrintReceipts: true,
  autoPrintKitchenOrders: true,
  autoPrintBarOrders: true,
  autoPrintRefunds: true
};

// Initial Store Administrator / Owner (PIN 1234)
export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp_owner',
    storeId: 'store_aura_main',
    name: 'Store Owner',
    email: 'owner@store.local',
    phone: '',
    role: 'owner',
    pin: '1234',
    active: true,
    lastLogin: new Date().toISOString(),
    permissions: [
      'pos',
      'sales',
      'refunds',
      'products',
      'inventory',
      'customers',
      'reports',
      'discounts',
      'settings',
      'employees',
      'category.view',
      'category.create',
      'category.edit',
      'category.delete',
      'category.reorder'
    ]
  }
];

// Production Clean Slate - Zero fake records
export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_DISCOUNTS: Discount[] = [];

export const INITIAL_TAX_CONFIGS: TaxConfig[] = [];

export const INITIAL_SALES: Sale[] = [];

export const INITIAL_INVENTORY_MOVEMENTS: InventoryMovement[] = [];
