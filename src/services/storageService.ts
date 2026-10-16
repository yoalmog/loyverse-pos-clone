import {
  Category,
  CategoryTranslation,
  CategoryAuditLog,
  Product,
  Customer,
  Employee,
  Sale,
  Refund,
  Discount,
  TaxConfig,
  StoreSettings,
  InventoryMovement,
  HeldOrder,
  OfflineSaleQueueItem
} from '../types/pos.ts';
import { Printer, PrinterRoute, PrintJob } from '../types/printer.ts';
import { Supplier, PurchaseOrder, StockCountSession } from '../types/inventoryOperations.ts';
import {
  StockTransfer,
  PromotionRule,
  WebhookSubscription,
  WebhookDeliveryLog,
  EmployeeAuditLog
} from '../types/advancedFeatures.ts';

import {
  INITIAL_STORE_SETTINGS,
  INITIAL_EMPLOYEES,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_DISCOUNTS,
  INITIAL_TAX_CONFIGS,
  INITIAL_SALES,
  INITIAL_INVENTORY_MOVEMENTS
} from '../data/initialData.ts';
import { INITIAL_PRINTERS, INITIAL_PRINTER_ROUTES } from '../data/initialPrinters.ts';

// Clean production keys (v2)
const STORAGE_KEYS = {
  SETTINGS: 'aurapos_store_settings_v2',
  EMPLOYEES: 'aurapos_employees_v2',
  CATEGORIES: 'aurapos_categories_v2',
  CATEGORY_TRANSLATIONS: 'aurapos_category_translations_v2',
  CATEGORY_AUDIT_LOGS: 'aurapos_category_audit_logs_v2',
  PRODUCTS: 'aurapos_products_v2',
  CUSTOMERS: 'aurapos_customers_v2',
  DISCOUNTS: 'aurapos_discounts_v2',
  TAX_CONFIGS: 'aurapos_tax_configs_v2',
  SALES: 'aurapos_sales_v2',
  REFUNDS: 'aurapos_refunds_v2',
  INVENTORY_MOVEMENTS: 'aurapos_inventory_movements_v2',
  HELD_ORDERS: 'aurapos_held_orders_v2',
  OFFLINE_QUEUE: 'aurapos_offline_queue_v2',
  CURRENT_USER_ID: 'aurapos_current_user_id_v2',
  PRINTERS: 'aurapos_printers_v2',
  PRINTER_ROUTES: 'aurapos_printer_routes_v2',
  PRINT_JOBS: 'aurapos_print_jobs_v2',
  QR_PAYMENTS: 'aurapos_qr_payments_v2',
  PAYMENT_AUDIT_LOGS: 'aurapos_payment_audit_logs_v2',
  PRODUCT_IMAGE_HISTORY: 'aurapos_product_image_history_v2',
  SUPPLIERS: 'aurapos_suppliers_v2',
  PURCHASE_ORDERS: 'aurapos_purchase_orders_v2',
  STOCK_COUNT_SESSIONS: 'aurapos_stock_count_sessions_v2',
  TRANSFERS: 'aurapos_stock_transfers_v2',
  PROMOTIONS: 'aurapos_promotions_v2',
  WEBHOOK_SUBSCRIPTIONS: 'aurapos_webhook_subs_v2',
  WEBHOOK_LOGS: 'aurapos_webhook_logs_v2',
  EMPLOYEE_AUDIT_LOGS: 'aurapos_employee_audit_logs_v2'
};

export interface PaymentAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  terminalId?: string;
  action: string;
  details: string;
}

export const INITIAL_QR_PAYMENT_SETTINGS: import('../types/pos.ts').QrPaymentSettings = {
  yape: {
    enabled: true,
    displayName: 'Yape',
    phoneAccount: '',
    accountHolder: '',
    qrImageUrl: '',
    qrVersion: 1,
    receiptLabel: 'Pay with Yape',
    paymentInstructions: 'Scan with your Yape app to pay',
    showOnCheckout: true,
    showOnReceipt: true,
    qrPrintSize: 'medium',
    qrPrintPosition: 'AFTER_PAYMENT'
  },
  plin: {
    enabled: true,
    displayName: 'Plin',
    phoneAccount: '',
    accountHolder: '',
    qrImageUrl: '',
    qrVersion: 1,
    receiptLabel: 'Pay with Plin',
    paymentInstructions: 'Scan with your Plin or Banking app to pay',
    showOnCheckout: true,
    showOnReceipt: true,
    qrPrintSize: 'medium',
    qrPrintPosition: 'AFTER_PAYMENT'
  },
  printBothOnReceipts: false
};

// Purge legacy demo keys from v1
if (typeof localStorage !== 'undefined') {
  try {
    const legacyKeys = [
      'aurapos_store_settings_v1',
      'aurapos_employees_v1',
      'aurapos_categories_v1',
      'aurapos_products_v1',
      'aurapos_customers_v1',
      'aurapos_discounts_v1',
      'aurapos_tax_configs_v1',
      'aurapos_sales_v1',
      'aurapos_refunds_v1',
      'aurapos_inventory_movements_v1',
      'aurapos_held_orders_v1',
      'aurapos_offline_queue_v1',
      'aurapos_current_user_id_v1',
      'aurapos_printers_v1',
      'aurapos_printer_routes_v1',
      'aurapos_print_jobs_v1',
      'aurapos_offline_simulation_mode_v1'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

const memoryStorage = new Map<string, string>();

function getStorageItem<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    }
    const mem = memoryStorage.get(key);
    if (!mem) return fallback;
    return JSON.parse(mem);
  } catch (e) {
    return fallback;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    } else {
      memoryStorage.set(key, serialized);
    }
  } catch (e) {
    // Ignore storage errors in restricted contexts
  }
}

export class StorageService {
  // Store Settings
  static getSettings(): StoreSettings {
    const saved = getStorageItem<StoreSettings>(STORAGE_KEYS.SETTINGS, INITIAL_STORE_SETTINGS);
    return { ...INITIAL_STORE_SETTINGS, ...saved };
  }
  static saveSettings(settings: StoreSettings): void {
    setStorageItem(STORAGE_KEYS.SETTINGS, settings);
  }

  // Employees
  static getEmployees(): Employee[] {
    return getStorageItem<Employee[]>(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES);
  }
  static saveEmployees(employees: Employee[]): void {
    setStorageItem(STORAGE_KEYS.EMPLOYEES, employees);
  }

  // Current Logged-in Employee
  static getCurrentEmployee(): Employee {
    const employees = this.getEmployees();
    const currentId = getStorageItem<string>(STORAGE_KEYS.CURRENT_USER_ID, 'emp_owner');
    const found = employees.find(e => e.id === currentId && e.active);
    return found || employees[0];
  }
  static setCurrentEmployee(employeeId: string): void {
    setStorageItem(STORAGE_KEYS.CURRENT_USER_ID, employeeId);
  }

  // Categories
  static getCategories(): Category[] {
    return getStorageItem<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
  }
  static saveCategories(categories: Category[]): void {
    setStorageItem(STORAGE_KEYS.CATEGORIES, categories);
  }

  // Category Multilingual Translations (Section 19)
  static getCategoryTranslations(): CategoryTranslation[] {
    return getStorageItem<CategoryTranslation[]>(STORAGE_KEYS.CATEGORY_TRANSLATIONS, []);
  }
  static saveCategoryTranslations(translations: CategoryTranslation[]): void {
    setStorageItem(STORAGE_KEYS.CATEGORY_TRANSLATIONS, translations);
  }

  // Category Audit Log (Section 28)
  static getCategoryAuditLogs(): CategoryAuditLog[] {
    return getStorageItem<CategoryAuditLog[]>(STORAGE_KEYS.CATEGORY_AUDIT_LOGS, []);
  }
  static saveCategoryAuditLogs(logs: CategoryAuditLog[]): void {
    setStorageItem(STORAGE_KEYS.CATEGORY_AUDIT_LOGS, logs);
  }
  static logCategoryAudit(actionData: Omit<CategoryAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getCategoryAuditLogs();
    const newLog: CategoryAuditLog = {
      id: `audit_cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...actionData
    };
    logs.unshift(newLog);
    // Keep last 200 logs
    this.saveCategoryAuditLogs(logs.slice(0, 200));
  }

  // Products
  static getProducts(): Product[] {
    return getStorageItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
  }
  static saveProducts(products: Product[]): void {
    setStorageItem(STORAGE_KEYS.PRODUCTS, products);
  }

  // Customers
  static getCustomers(): Customer[] {
    return getStorageItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }
  static saveCustomers(customers: Customer[]): void {
    setStorageItem(STORAGE_KEYS.CUSTOMERS, customers);
  }

  // Sales
  static getSales(): Sale[] {
    return getStorageItem<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
  }
  static saveSales(sales: Sale[]): void {
    setStorageItem(STORAGE_KEYS.SALES, sales);
  }

  // Refunds
  static getRefunds(): Refund[] {
    return getStorageItem<Refund[]>(STORAGE_KEYS.REFUNDS, []);
  }
  static saveRefunds(refunds: Refund[]): void {
    setStorageItem(STORAGE_KEYS.REFUNDS, refunds);
  }

  // Inventory Movements
  static getInventoryMovements(): InventoryMovement[] {
    return getStorageItem<InventoryMovement[]>(STORAGE_KEYS.INVENTORY_MOVEMENTS, INITIAL_INVENTORY_MOVEMENTS);
  }
  static saveInventoryMovements(movements: InventoryMovement[]): void {
    setStorageItem(STORAGE_KEYS.INVENTORY_MOVEMENTS, movements);
  }

  // Held Orders
  static getHeldOrders(): HeldOrder[] {
    return getStorageItem<HeldOrder[]>(STORAGE_KEYS.HELD_ORDERS, []);
  }
  static saveHeldOrders(heldOrders: HeldOrder[]): void {
    setStorageItem(STORAGE_KEYS.HELD_ORDERS, heldOrders);
  }

  // Discounts
  static getDiscounts(): Discount[] {
    return getStorageItem<Discount[]>(STORAGE_KEYS.DISCOUNTS, INITIAL_DISCOUNTS);
  }
  static saveDiscounts(discounts: Discount[]): void {
    setStorageItem(STORAGE_KEYS.DISCOUNTS, discounts);
  }

  // Tax Configurations
  static getTaxConfigs(): TaxConfig[] {
    return getStorageItem<TaxConfig[]>(STORAGE_KEYS.TAX_CONFIGS, INITIAL_TAX_CONFIGS);
  }
  static saveTaxConfigs(configs: TaxConfig[]): void {
    setStorageItem(STORAGE_KEYS.TAX_CONFIGS, configs);
  }

  // Offline Sync Queue
  static getOfflineQueue(): OfflineSaleQueueItem[] {
    return getStorageItem<OfflineSaleQueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }
  static saveOfflineQueue(queue: OfflineSaleQueueItem[]): void {
    setStorageItem(STORAGE_KEYS.OFFLINE_QUEUE, queue);
  }

  // Printers Registry (Only real configured / scanned hardware devices)
  static getPrinters(): Printer[] {
    const list = getStorageItem<Printer[]>(STORAGE_KEYS.PRINTERS, INITIAL_PRINTERS);
    return list.filter(
      p =>
        p &&
        !p.id.startsWith('mock_') &&
        p.id !== 'prn_x18_main' &&
        p.id !== 'prn_lan_kitchen' &&
        p.id !== 'prn_mobile_receipt'
    );
  }
  static savePrinters(printers: Printer[]): void {
    setStorageItem(STORAGE_KEYS.PRINTERS, printers);
  }
  static savePrinter(printer: Printer): void {
    const printers = this.getPrinters();
    const idx = printers.findIndex(p => p.id === printer.id);
    if (idx !== -1) {
      printers[idx] = { ...printer, updatedAt: new Date().toISOString() };
    } else {
      printers.unshift(printer);
    }
    this.savePrinters(printers);
  }

  // Printer Routing
  static getPrinterRoutes(): PrinterRoute[] {
    return getStorageItem<PrinterRoute[]>(STORAGE_KEYS.PRINTER_ROUTES, INITIAL_PRINTER_ROUTES);
  }
  static savePrinterRoutes(routes: PrinterRoute[]): void {
    setStorageItem(STORAGE_KEYS.PRINTER_ROUTES, routes);
  }

  // Print Jobs Queue
  static getPrintJobs(): PrintJob[] {
    return getStorageItem<PrintJob[]>(STORAGE_KEYS.PRINT_JOBS, []);
  }
  static savePrintJobs(jobs: PrintJob[]): void {
    setStorageItem(STORAGE_KEYS.PRINT_JOBS, jobs);
  }

  // QR Digital Payments Configuration (Yape & Plin)
  static getQrPaymentSettings(): import('../types/pos.ts').QrPaymentSettings {
    return getStorageItem<import('../types/pos.ts').QrPaymentSettings>(
      STORAGE_KEYS.QR_PAYMENTS,
      INITIAL_QR_PAYMENT_SETTINGS
    );
  }
  static saveQrPaymentSettings(settings: import('../types/pos.ts').QrPaymentSettings): void {
    setStorageItem(STORAGE_KEYS.QR_PAYMENTS, settings);
  }

  // Payment Configuration Audit Logs
  static getPaymentAuditLogs(): PaymentAuditLog[] {
    return getStorageItem<PaymentAuditLog[]>(STORAGE_KEYS.PAYMENT_AUDIT_LOGS, []);
  }
  static savePaymentAuditLogs(logs: PaymentAuditLog[]): void {
    setStorageItem(STORAGE_KEYS.PAYMENT_AUDIT_LOGS, logs);
  }
  static logPaymentAudit(actionData: Omit<PaymentAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getPaymentAuditLogs();
    const newLog: PaymentAuditLog = {
      id: `audit_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...actionData
    };
    logs.unshift(newLog);
    this.savePaymentAuditLogs(logs.slice(0, 200));
  }

  // Product Image History & Versions
  static getProductImageHistory(productId?: string): import('../types/pos.ts').ProductImageMetadata[] {
    const all = getStorageItem<import('../types/pos.ts').ProductImageMetadata[]>(
      STORAGE_KEYS.PRODUCT_IMAGE_HISTORY,
      []
    );
    return productId ? all.filter(m => m.productId === productId) : all;
  }
  static saveProductImageMetadata(meta: import('../types/pos.ts').ProductImageMetadata): void {
    const all = this.getProductImageHistory();
    all.unshift(meta);
    setStorageItem(STORAGE_KEYS.PRODUCT_IMAGE_HISTORY, all.slice(0, 500));
  }

  // Suppliers Management
  static getSuppliers(storeId?: string): Supplier[] {
    const list = getStorageItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    return storeId ? list.filter(s => s.storeId === storeId) : list;
  }
  static saveSuppliers(suppliers: Supplier[]): void {
    setStorageItem(STORAGE_KEYS.SUPPLIERS, suppliers);
  }

  // Purchase Orders Management
  static getPurchaseOrders(storeId?: string): PurchaseOrder[] {
    const list = getStorageItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, []);
    return storeId ? list.filter(po => po.storeId === storeId) : list;
  }
  static savePurchaseOrders(orders: PurchaseOrder[]): void {
    setStorageItem(STORAGE_KEYS.PURCHASE_ORDERS, orders);
  }

  // Stock Count Sessions Management
  static getStockCountSessions(storeId?: string): StockCountSession[] {
    const list = getStorageItem<StockCountSession[]>(STORAGE_KEYS.STOCK_COUNT_SESSIONS, []);
    return storeId ? list.filter(sc => sc.storeId === storeId) : list;
  }
  static saveStockCountSessions(sessions: StockCountSession[]): void {
    setStorageItem(STORAGE_KEYS.STOCK_COUNT_SESSIONS, sessions);
  }

  // Stock Transfers Management
  static getStockTransfers(storeId?: string): StockTransfer[] {
    const list = getStorageItem<StockTransfer[]>(STORAGE_KEYS.TRANSFERS, []);
    return storeId
      ? list.filter(t => t.sourceStoreId === storeId || t.destinationStoreId === storeId)
      : list;
  }
  static saveStockTransfers(transfers: StockTransfer[]): void {
    setStorageItem(STORAGE_KEYS.TRANSFERS, transfers);
  }

  // Promotions Management
  static getPromotions(): PromotionRule[] {
    return getStorageItem<PromotionRule[]>(STORAGE_KEYS.PROMOTIONS, []);
  }
  static savePromotions(promotions: PromotionRule[]): void {
    setStorageItem(STORAGE_KEYS.PROMOTIONS, promotions);
  }

  // Webhook Subscriptions Management
  static getWebhookSubscriptions(): WebhookSubscription[] {
    return getStorageItem<WebhookSubscription[]>(STORAGE_KEYS.WEBHOOK_SUBSCRIPTIONS, []);
  }
  static saveWebhookSubscriptions(subs: WebhookSubscription[]): void {
    setStorageItem(STORAGE_KEYS.WEBHOOK_SUBSCRIPTIONS, subs);
  }

  // Webhook Delivery Logs Management
  static getWebhookLogs(): WebhookDeliveryLog[] {
    return getStorageItem<WebhookDeliveryLog[]>(STORAGE_KEYS.WEBHOOK_LOGS, []);
  }
  static saveWebhookLogs(logs: WebhookDeliveryLog[]): void {
    setStorageItem(STORAGE_KEYS.WEBHOOK_LOGS, logs.slice(0, 200));
  }

  // Employee Audit Logs Management
  static getEmployeeAuditLogs(employeeId?: string): EmployeeAuditLog[] {
    const list = getStorageItem<EmployeeAuditLog[]>(STORAGE_KEYS.EMPLOYEE_AUDIT_LOGS, []);
    return employeeId ? list.filter(l => l.employeeId === employeeId) : list;
  }
  static saveEmployeeAuditLogs(logs: EmployeeAuditLog[]): void {
    setStorageItem(STORAGE_KEYS.EMPLOYEE_AUDIT_LOGS, logs.slice(0, 500));
  }

  // Reset all local storage data
  static resetAllData(): void {
    Object.values(STORAGE_KEYS).forEach(k => {
      localStorage.removeItem(k);
    });
  }
}
