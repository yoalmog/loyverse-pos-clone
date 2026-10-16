import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { PinService } from '../services/pinService.ts';
import {
  AccessibilitySettings,
  CartItem,
  Category,
  Customer,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  Discount,
  Employee,
  HeldOrder,
  InventoryMovement,
  Product,
  ProductVariant,
  Sale,
  StoreSettings,
  TaxConfig
} from '../types/pos.ts';
import { StorageService } from '../services/storageService.ts';
import { PosService } from '../services/posService.ts';
import { SalesService } from '../services/salesService.ts';
import { AccessibilityService } from '../services/accessibilityService.ts';
import { Currency } from '../utils/currency.ts';
import { SyncEngine, SyncEngineStatus } from '../services/sync/SyncEngine.ts';
import {
  TRANSLATIONS,
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LOCALES,
  translate,
  getLocaleMetadata,
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocaleTime,
  formatLocaleNumber,
  CATEGORY_TRANSLATIONS,
  PRODUCT_TRANSLATIONS,
  COMMON_EXTRA_TRANSLATIONS
} from '../i18n/index.ts';
import { ThemeColor, ThemePreset, getTheme, applyThemeVariables } from '../utils/theme.ts';
import { ThemeService, SemanticColorTokens } from '../services/themeService.ts';
import { AppearanceSettings } from '../types/pos.ts';
import { StoreLocation } from '../types/backOffice.ts';
import { BackOfficeService } from '../services/backOfficeService.ts';

export type AppRoute =
  | 'pos'
  | 'checkout'
  | 'sales'
  | 'products'
  | 'categories'
  | 'menu-scanner'
  | 'inventory'
  | 'customers'
  | 'employees'
  | 'reports'
  | 'discounts'
  | 'settings'
  | 'backoffice';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

export interface PinAttemptResult {
  ok: boolean;
  /** Set when the PIN pad is temporarily locked after repeated failures */
  lockedForMs?: number;
}

interface POSContextType {
  // Navigation
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;

  // Sidebar Layout
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobileSidebar: () => void;

  // Localization & Theme
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, customSymbol?: string) => string;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  dir: 'ltr' | 'rtl';
  translateCategoryName: (categoryId: string, defaultName?: string) => string;
  translateProductName: (productId: string, defaultName?: string) => string;
  themeColor: ThemeColor;
  setThemeColor: (theme: ThemeColor) => void;
  currentTheme: ThemePreset;
  appearance: AppearanceSettings;
  updateAppearance: (partial: Partial<AppearanceSettings>) => void;
  resetAppearance: () => void;
  activeThemeTokens: SemanticColorTokens;

  // Security / Employee
  currentEmployee: Employee;
  switchEmployee: (employeeId: string) => void;
  isPinLocked: boolean;
  setIsPinLocked: (locked: boolean) => void;
  unlockWithPin: (pin: string, employeeId?: string) => Promise<PinAttemptResult>;
  isOwner: boolean;
  ownerEmployee: Employee | undefined;
  requireOwnerAuth: (callback: () => void, actionTitle?: string) => void;
  isOwnerAuthModalOpen: boolean;
  ownerAuthTitle: string;
  closeOwnerAuthModal: () => void;
  submitOwnerPin: (pin: string) => Promise<PinAttemptResult>;

  // Data
  settings: StoreSettings;
  updateSettings: (newSettings: StoreSettings) => void;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  inventoryMovements: InventoryMovement[];
  heldOrders: HeldOrder[];
  discounts: Discount[];
  taxConfigs: TaxConfig[];
  employees: Employee[];

  // Multi-Store Management (Phase 5)
  availableStores: StoreLocation[];
  currentStoreId: string;
  switchStore: (storeId: string) => Promise<void>;

  // Refresh
  refreshData: () => void;

  // POS Cart State
  cartItems: CartItem[];
  addToCart: (product: Product, variant?: ProductVariant, quantity?: number, notes?: string) => void;
  updateCartItemQty: (itemId: string, newQty: number) => void;
  removeCartItem: (itemId: string) => void;
  clearCart: () => void;
  activeCustomer: Customer | null;
  setActiveCustomer: (customer: Customer | null) => void;
  activeDiscount: Discount | null;
  setActiveDiscount: (discount: Discount | null) => void;
  cartNotes: string;
  setCartNotes: (notes: string) => void;

  // Calculated totals
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxRate: number;
  grandTotal: number;

  // Held Orders
  holdCurrentOrder: () => boolean;
  resumeOrder: (heldOrderId: string) => void;
  deleteHeldOrder: (heldOrderId: string) => void;

  // Offline / Network & Sync Engine (Phase 3)
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  triggerSync: () => void;
  syncEngineStatus: SyncEngineStatus;
  retryFailedSync: () => Promise<void>;

  // Toast notifications
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Quick modals
  openCustomerModal: boolean;
  setOpenCustomerModal: (open: boolean) => void;
  openDiscountModal: boolean;
  setOpenDiscountModal: (open: boolean) => void;
  openHeldOrdersModal: boolean;
  setOpenHeldOrdersModal: (open: boolean) => void;
  openBarcodeScannerModal: boolean;
  setOpenBarcodeScannerModal: (open: boolean) => void;
  completedSale: Sale | null;
  setCompletedSale: (sale: Sale | null) => void;

  // Accessibility System (Sections 1-26)
  accessibility: AccessibilitySettings;
  updateAccessibility: (settings: Partial<AccessibilitySettings>) => void;
  resetAccessibility: () => void;
  announceAccessibility: (text: string, priority?: 'polite' | 'assertive') => void;
  triggerHaptic: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
  playAudioCue: (type?: 'click' | 'add' | 'remove' | 'pay' | 'success' | 'error' | 'beep') => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeRoute, setActiveRoute] = useState<AppRoute>('pos');

  // Sidebar Layout
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(prev => !prev);
  }, []);

  // Employee & Lock
  const [employees, setEmployees] = useState<Employee[]>(() => StorageService.getEmployees());
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee>(() => StorageService.getCurrentEmployee());
  const [isPinLocked, setIsPinLocked] = useState<boolean>(false);

  // Core Data
  const [settings, setSettings] = useState<StoreSettings>(() => StorageService.getSettings());
  const [categories, setCategories] = useState<Category[]>(() => StorageService.getCategories());

  // Accessibility System State (Section 1-26)
  const [accessibility, setAccessibilityState] = useState<AccessibilitySettings>(() =>
    AccessibilityService.getSettings()
  );

  useEffect(() => {
    AccessibilityService.applyToDOM(accessibility);
  }, [accessibility]);

  const updateAccessibility = useCallback((partial: Partial<AccessibilitySettings>) => {
    const updated = AccessibilityService.saveSettings(partial);
    setAccessibilityState(updated);
  }, []);

  const resetAccessibility = useCallback(() => {
    const reset = AccessibilityService.resetToDefault();
    setAccessibilityState(reset);
  }, []);

  const announceAccessibility = useCallback((text: string, priority: 'polite' | 'assertive' = 'polite') => {
    AccessibilityService.announce(text, priority);
  }, []);

  const triggerHaptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
      AccessibilityService.triggerHaptic(type);
    },
    []
  );

  const playAudioCue = useCallback(
    (type: 'click' | 'add' | 'remove' | 'pay' | 'success' | 'error' | 'beep' = 'click') => {
      AccessibilityService.playAudioCue(type);
    },
    []
  );

  // Localization & Theme
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('aurapos_lang') as SupportedLanguage) : null;
    return saved || (StorageService.getSettings().language as SupportedLanguage) || 'en';
  });

  // Ensure DOM language and direction are strictly in sync with state on mount & update
  useEffect(() => {
    const langOpt = SUPPORTED_LANGUAGES.find(l => l.code === language);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', langOpt?.dir || 'ltr');
    }
  }, [language]);

  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    return (StorageService.getSettings().themeColor as ThemeColor) || 'emerald';
  });

  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    const s = StorageService.getSettings();
    return ThemeService.extractAppearance(s);
  });

  const activeThemeTokens = useMemo(() => ThemeService.getTokens(appearance), [appearance]);

  const currentTheme = useMemo(() => getTheme(themeColor), [themeColor]);

  const t = useCallback(
    (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>): string => {
      return translate(language, key, fallbackOrParams, params);
    },
    [language]
  );

  const meta = useMemo(() => getLocaleMetadata(language), [language]);
  const dir = meta.direction;

  const formatCurrency = useCallback(
    (amount: number, customSymbol?: string): string => {
      const sym = customSymbol !== undefined ? customSymbol : (settings.currency || '$');
      return formatLocaleCurrency(amount, sym, language);
    },
    [language, settings.currency]
  );

  const formatDate = useCallback(
    (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
      return formatLocaleDate(date, language, options);
    },
    [language]
  );

  const formatTime = useCallback(
    (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
      return formatLocaleTime(date, language, options);
    },
    [language]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      return formatLocaleNumber(value, language, options);
    },
    [language]
  );

  const translateCategoryName = useCallback((categoryId: string, defaultName?: string): string => {
    // 1. Check real category_translations table from database
    const dbTranslations = StorageService.getCategoryTranslations();
    const match = dbTranslations.find(t => t.categoryId === categoryId && t.locale === language);
    if (match && match.name && match.name.trim()) return match.name;

    // 2. Check category object itself in categories state
    const cat = categories.find(c => c.id === categoryId);
    if (cat?.translations?.[language]?.name) {
      return cat.translations[language].name;
    }

    // 3. Fallback to category's default name
    if (cat?.name) return cat.name;
    if (defaultName && !defaultName.startsWith('category.')) return defaultName;

    // 4. Static catalog fallback if applicable
    const staticLoc = CATEGORY_TRANSLATIONS[language]?.[categoryId] || CATEGORY_TRANSLATIONS.en?.[categoryId];
    if (staticLoc) return staticLoc;

    return defaultName || categoryId;
  }, [language, categories]);

  const translateProductName = useCallback((productId: string, defaultName?: string): string => {
    const localized = PRODUCT_TRANSLATIONS[language]?.[productId];
    if (localized) return localized;
    const fallbackLoc = PRODUCT_TRANSLATIONS.en?.[productId];
    return defaultName || fallbackLoc || productId;
  }, [language]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aurapos_lang', lang);
    }
    const curr = StorageService.getSettings();
    const updated = { ...curr, language: lang };
    StorageService.saveSettings(updated);
    setSettings(updated);

    const langOpt = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', langOpt?.dir || 'ltr');
    }
  }, []);

  const updateAppearance = useCallback((partial: Partial<AppearanceSettings>) => {
    setAppearance(prev => {
      const next: AppearanceSettings = { ...prev, ...partial };
      const s = StorageService.getSettings();
      const mappedColor = (next.palette === 'custom' ? 'blue' : next.palette) as ThemeColor;
      const updatedSettings: StoreSettings = {
        ...s,
        themeMode: next.mode,
        themePalette: next.palette,
        themeColor: mappedColor,
        themeBackgroundStyle: next.backgroundStyle,
        themePattern: next.pattern,
        themeAccentColor: next.accentColor,
        themeCustomColors: next.customColors
      };
      StorageService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setThemeColorState(mappedColor);
      ThemeService.applyToDOM(next, updatedSettings);
      return next;
    });
  }, []);

  const resetAppearance = useCallback(() => {
    const defaultAppearance: AppearanceSettings = {
      mode: 'light',
      palette: 'blue',
      backgroundStyle: 'soft-tint',
      pattern: 'none'
    };
    updateAppearance(defaultAppearance);
  }, [updateAppearance]);

  const setThemeColor = useCallback((theme: ThemeColor) => {
    setThemeColorState(theme);
    updateAppearance({ palette: theme as any });
  }, [updateAppearance]);

  useEffect(() => {
    ThemeService.applyToDOM(appearance, settings);
    const langOpt = SUPPORTED_LANGUAGES.find(l => l.code === language);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', langOpt?.dir || 'ltr');
    }
  }, [appearance, language, settings]);
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [customers, setCustomers] = useState<Customer[]>(() => StorageService.getCustomers());
  const [sales, setSales] = useState<Sale[]>(() => StorageService.getSales());
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => StorageService.getInventoryMovements());
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => StorageService.getHeldOrders());
  const [discounts, setDiscounts] = useState<Discount[]>(() => StorageService.getDiscounts());
  const [taxConfigs, setTaxConfigs] = useState<TaxConfig[]>(() => StorageService.getTaxConfigs());

  // Multi-Store Management (Phase 5)
  const [availableStores, setAvailableStores] = useState<StoreLocation[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string>(() => settings.id || 'store_aura_main');

  useEffect(() => {
    BackOfficeService.getStores().then(st => setAvailableStores(st)).catch(() => {});
  }, []);

  // Hydrate catalog and real food photography from PostgreSQL if available
  useEffect(() => {
    const syncWithPostgres = async () => {
      try {
        const res = await fetch('/api/pos/catalog');
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          const { categories: pgCategories, products: pgProducts, customers: pgCustomers, discounts: pgDiscounts } = json.data;
          if (pgCategories && pgCategories.length > 0) {
            const mappedCats: Category[] = pgCategories.map((c: any) => ({
              id: c.id,
              storeId: 'store_aura_main',
              name: c.name,
              iconName: c.icon_name || 'Utensils',
              color: c.color || '#059669',
              sortOrder: c.sort_order || 0,
              active: true
            }));
            setCategories(mappedCats);
            StorageService.saveCategories(mappedCats);
          }
          if (pgProducts && pgProducts.length > 0) {
            const mappedProds: Product[] = pgProducts.map((p: any) => ({
              id: p.id,
              storeId: 'store_aura_main',
              categoryId: p.category_id,
              name: p.name,
              sku: p.sku || '',
              barcode: p.barcode || '',
              price: (p.price || 0) / 100,
              cost: (p.cost || 0) / 100,
              unit: 'item',
              trackInventory: p.track_stock === 1,
              stock: p.stock_quantity ?? 100,
              lowStockThreshold: p.low_stock_threshold ?? 5,
              active: true,
              isFavorite: Boolean(p.is_favorite),
              color: p.color || '#059669',
              imageUrl: p.image_url || undefined,
              variants: p.variations?.map((v: any) => ({
                id: v.id,
                productId: p.id,
                name: v.name,
                sku: v.sku || '',
                price: (v.price || p.price) / 100,
                cost: (v.cost || 0) / 100,
                active: true,
                attributes: {}
              })) || []
            }));
            setProducts(mappedProds);
            StorageService.saveProducts(mappedProds);
          }
          if (pgCustomers && pgCustomers.length > 0) {
            const mappedCusts: Customer[] = pgCustomers.map((c: any) => ({
              id: c.id,
              storeId: 'store_aura_main',
              firstName: c.name.split(' ')[0] || c.name,
              lastName: c.name.split(' ').slice(1).join(' ') || '',
              email: c.email || '',
              phone: c.phone || '',
              loyaltyPoints: c.total_points || 0,
              totalSpent: (c.total_spent || 0) / 100,
              active: true
            }));
            setCustomers(mappedCusts);
            StorageService.saveCustomers(mappedCusts);
          }
          if (pgDiscounts && pgDiscounts.length > 0) {
            const mappedDiscs: Discount[] = pgDiscounts.map((d: any) => ({
              id: d.id,
              storeId: 'store_aura_main',
              name: d.name,
              type: d.type === 'PERCENT' ? 'percentage' : 'fixed',
              value: d.type === 'PERCENT' ? d.value : d.value / 100,
              active: d.active === 1
            }));
            setDiscounts(mappedDiscs);
            StorageService.saveDiscounts(mappedDiscs);
          }
        }
      } catch (e) {
        console.warn('Initial PostgreSQL catalog sync deferred to local offline store:', e);
      }
    };
    syncWithPostgres();
  }, []);

  // Offline & Sync Engine (Phase 3 centralized sync)
  const [syncEngineStatus, setSyncEngineStatus] = useState<SyncEngineStatus>(() => SyncEngine.getStatus());
  const [isOffline, setIsOffline] = useState<boolean>(() => !SyncEngine.isOnline());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  useEffect(() => {
    SyncEngine.start();
    const unsub = SyncEngine.subscribe(status => {
      setSyncEngineStatus(status);
      setIsOffline(!status.isOnline);
      setIsSyncing(status.state === 'SYNCING');
      setPendingSyncCount(status.pendingUploads);
    });

    SyncEngine.getPendingCount().then(cnt => setPendingSyncCount(cnt)).catch(() => {});

    return () => unsub();
  }, []);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [activeDiscount, setActiveDiscount] = useState<Discount | null>(null);
  const [cartNotes, setCartNotes] = useState<string>('');

  // Modals
  const [openCustomerModal, setOpenCustomerModal] = useState<boolean>(false);
  const [openDiscountModal, setOpenDiscountModal] = useState<boolean>(false);
  const [openHeldOrdersModal, setOpenHeldOrdersModal] = useState<boolean>(false);
  const [openBarcodeScannerModal, setOpenBarcodeScannerModal] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    const duration = toast.duration ?? 3500;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshData = useCallback(() => {
    setSettings(StorageService.getSettings());
    setEmployees(StorageService.getEmployees());
    setCurrentEmployeeState(StorageService.getCurrentEmployee());
    setCategories(StorageService.getCategories());
    setProducts(StorageService.getProducts());
    setCustomers(StorageService.getCustomers());
    setSales(StorageService.getSales());
    setInventoryMovements(StorageService.getInventoryMovements());
    setHeldOrders(StorageService.getHeldOrders());
    setDiscounts(StorageService.getDiscounts());
    setTaxConfigs(StorageService.getTaxConfigs());
    setPendingSyncCount(StorageService.getOfflineQueue().length);
    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);

    // Asynchronously refresh from PostgreSQL
    fetch('/api/pos/catalog')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          const { categories: pgCategories, products: pgProducts } = json.data;
          if (pgCategories && pgCategories.length > 0) {
            const mappedCats: Category[] = pgCategories.map((c: any) => ({
              id: c.id,
              storeId: 'store_aura_main',
              name: c.name,
              iconName: c.icon_name || 'Utensils',
              color: c.color || '#059669',
              sortOrder: c.sort_order || 0,
              active: true
            }));
            setCategories(mappedCats);
            StorageService.saveCategories(mappedCats);
          }
          if (pgProducts && pgProducts.length > 0) {
            const mappedProds: Product[] = pgProducts.map((p: any) => ({
              id: p.id,
              storeId: 'store_aura_main',
              categoryId: p.category_id,
              name: p.name,
              sku: p.sku || '',
              barcode: p.barcode || '',
              price: (p.price || 0) / 100,
              cost: (p.cost || 0) / 100,
              unit: 'item',
              trackInventory: p.track_stock === 1,
              stock: p.stock_quantity ?? 100,
              lowStockThreshold: p.low_stock_threshold ?? 5,
              active: true,
              isFavorite: Boolean(p.is_favorite),
              color: p.color || '#059669',
              imageUrl: p.image_url || undefined,
              createdAt: p.created_at || new Date().toISOString(),
              updatedAt: p.updated_at || new Date().toISOString()
            }));
            setProducts(mappedProds);
            StorageService.saveProducts(mappedProds);
          }
        }
      })
      .catch(() => {});
  }, []);

  const updateSettings = useCallback((newSettings: StoreSettings) => {
    StorageService.saveSettings(newSettings);
    setSettings(newSettings);
    if (newSettings.language && newSettings.language !== language) {
      setLanguage(newSettings.language as SupportedLanguage);
    }
    if (newSettings.themeColor && newSettings.themeColor !== themeColor) {
      setThemeColor(newSettings.themeColor as ThemeColor);
    }
    showToast({ type: 'success', title: 'Settings saved successfully' });
  }, [showToast, language, themeColor, setLanguage, setThemeColor]);

  const switchEmployee = useCallback((employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (emp) {
      StorageService.setCurrentEmployee(employeeId);
      setCurrentEmployeeState(emp);
      showToast({ type: 'info', title: `Active user: ${emp.name}`, message: `Role: ${emp.role.toUpperCase()}` });
    }
  }, [employees, showToast]);

  const isOwner = useMemo(() => {
    return currentEmployee.role === 'owner';
  }, [currentEmployee]);

  const ownerEmployee = useMemo(() => {
    return employees.find(e => e.role === 'owner') || employees[0];
  }, [employees]);

  // Owner Authorization modal state for administrative actions
  const [isOwnerAuthModalOpen, setIsOwnerAuthModalOpen] = useState<boolean>(false);
  const [ownerAuthTitle, setOwnerAuthTitle] = useState<string>('');
  const [pendingOwnerAction, setPendingOwnerAction] = useState<(() => void) | null>(null);

  const requireOwnerAuth = useCallback((callback: () => void, actionTitle?: string) => {
    if (isOwner) {
      callback();
    } else {
      setOwnerAuthTitle(actionTitle || 'Only the owner can make changes');
      setPendingOwnerAction(() => callback);
      setIsOwnerAuthModalOpen(true);
    }
  }, [isOwner]);

  const closeOwnerAuthModal = useCallback(() => {
    setIsOwnerAuthModalOpen(false);
    setPendingOwnerAction(null);
    setOwnerAuthTitle('');
  }, []);

  const submitOwnerPin = useCallback(async (pin: string): Promise<PinAttemptResult> => {
    const scope = 'owner';
    const remaining = PinService.getLockRemainingMs(scope);
    if (remaining > 0) return { ok: false, lockedForMs: remaining };

    let matchedOwner: Employee | undefined;
    for (const e of employees.filter(e => e.role === 'owner' && e.active)) {
      if (await PinService.verify(pin, e.pin)) { matchedOwner = e; break; }
    }
    if (matchedOwner) {
      PinService.recordSuccess(scope);
      // Switch active user to owner or execute authorized action
      switchEmployee(matchedOwner.id);
      setIsOwnerAuthModalOpen(false);
      showToast({ type: 'success', title: 'Owner Authorized', message: `Action authorized by ${matchedOwner.name}` });
      if (pendingOwnerAction) {
        pendingOwnerAction();
        setPendingOwnerAction(null);
      }
      return { ok: true };
    }
    return { ok: false, lockedForMs: PinService.recordFailure(scope) || undefined };
  }, [employees, switchEmployee, pendingOwnerAction, showToast]);

  const unlockWithPin = useCallback(async (pin: string, employeeId?: string): Promise<PinAttemptResult> => {
    const scope = `unlock:${employeeId || 'any'}`;
    const remaining = PinService.getLockRemainingMs(scope);
    if (remaining > 0) return { ok: false, lockedForMs: remaining };

    let matched: Employee | undefined;
    for (const e of employees.filter(e => e.active && (!employeeId || e.id === employeeId))) {
      if (await PinService.verify(pin, e.pin)) { matched = e; break; }
    }
    if (matched) {
      PinService.recordSuccess(scope);
      switchEmployee(matched.id);
      setIsPinLocked(false);
      showToast({ type: 'success', title: `Welcome back, ${matched.name}` });
      return { ok: true };
    }
    return { ok: false, lockedForMs: PinService.recordFailure(scope) || undefined };
  }, [employees, switchEmployee, showToast]);

  // One-time migration: hash any legacy plaintext PINs found in storage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = StorageService.getEmployees();
      if (all.every(e => PinService.isHashed(e.pin))) return;
      try {
        const migrated = await Promise.all(
          all.map(async e => (PinService.isHashed(e.pin) ? e : { ...e, pin: await PinService.hash(e.pin) }))
        );
        if (cancelled) return;
        StorageService.saveEmployees(migrated);
        setEmployees(migrated);
        setCurrentEmployeeState(StorageService.getCurrentEmployee());
      } catch (err) {
        console.warn('[PIN] Migration to hashed PINs failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cart operations
  const addToCart = useCallback((product: Product, variant?: ProductVariant, quantity = 1, notes?: string) => {
    if (!product.active || (variant && !variant.active)) {
      showToast({ type: 'warning', title: 'Product inactive', message: `${product.name} is disabled.` });
      triggerHaptic('warning');
      return;
    }

    const availableStock = variant?.stock !== undefined ? variant.stock : product.stock;
    if (product.trackInventory && availableStock <= 0 && !settings.allowNegativeStock) {
      showToast({
        type: 'error',
        title: 'Out of Stock',
        message: `${variant ? `${product.name} (${variant.name})` : product.name} has 0 units remaining.`
      });
      triggerHaptic('error');
      playAudioCue('error');
      return;
    }

    const price = variant ? variant.price : product.price;
    const cost = variant ? variant.cost : product.cost;
    const variantId = variant?.id;
    const variantName = variant?.name;

    // Accessibility feedback
    playAudioCue('add');
    triggerHaptic('light');
    const itemName = variant ? `${product.name} ${variant.name}` : product.name;
    announceAccessibility(`${itemName} added to cart. Price: ${settings.currency || '$'}${price.toFixed(2)}.`);

    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id && item.variantId === variantId && (item.notes || '') === (notes || ''));
      if (existingIdx !== -1) {
        const item = prev[existingIdx];
        const newQty = item.quantity + quantity;

        if (product.trackInventory && newQty > availableStock && !settings.allowNegativeStock) {
          showToast({
            type: 'warning',
            title: 'Stock limit reached',
            message: `Only ${availableStock} units available for ${variant ? variant.name : product.name}.`
          });
          triggerHaptic('warning');
          return prev;
        }

        const updated = [...prev];
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          lineTotal: Currency.multiply(item.unitPrice, newQty)
        };
        return updated;
      }

      const activeTax = taxConfigs.find(t => t.active)?.rate ?? 0.08625;
      const newItem: CartItem = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        productName: product.name,
        variantId,
        variantName,
        unitPrice: price,
        costPrice: cost,
        quantity,
        discountAmount: 0,
        taxRate: activeTax,
        lineTotal: Currency.multiply(price, quantity),
        notes: notes?.trim() || undefined,
        imageUrl: product.imageUrl,
        color: product.color
      };

      return [newItem, ...prev];
    });
  }, [settings.allowNegativeStock, settings.currency, showToast, taxConfigs, triggerHaptic, playAudioCue, announceAccessibility]);

  const updateCartItemQty = useCallback((itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeCartItem(itemId);
      return;
    }

    setCartItems(prev => {
      const idx = prev.findIndex(item => item.id === itemId);
      if (idx === -1) return prev;
      const item = prev[idx];
      const prod = products.find(p => p.id === item.productId);

      if (prod && prod.trackInventory && newQty > prod.stock && !settings.allowNegativeStock) {
        showToast({ type: 'warning', title: 'Stock limit', message: `Only ${prod.stock} in stock.` });
        triggerHaptic('warning');
        return prev;
      }

      if (newQty > item.quantity) {
        playAudioCue('add');
      } else {
        playAudioCue('remove');
      }
      triggerHaptic('light');

      const updated = [...prev];
      updated[idx] = {
        ...item,
        quantity: newQty,
        lineTotal: Currency.multiply(item.unitPrice, newQty)
      };
      return updated;
    });
  }, [products, settings.allowNegativeStock, showToast, triggerHaptic, playAudioCue]);

  const removeCartItem = useCallback((itemId: string) => {
    playAudioCue('remove');
    triggerHaptic('medium');
    setCartItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (item) {
        announceAccessibility(`${item.productName} removed from cart.`);
      }
      return prev.filter(i => i.id !== itemId);
    });
  }, [playAudioCue, triggerHaptic, announceAccessibility]);

  const clearCart = useCallback(() => {
    playAudioCue('remove');
    triggerHaptic('medium');
    announceAccessibility('Cart cleared.');
    setCartItems([]);
    setActiveCustomer(null);
    setActiveDiscount(null);
    setCartNotes('');
  }, [playAudioCue, triggerHaptic, announceAccessibility]);

  const taxRate = useMemo(() => {
    const active = taxConfigs.find(t => t.active);
    return active ? active.rate : 0.08625;
  }, [taxConfigs]);

  // Unified financial calculation using SalesService avoiding floating point discrepancies
  const cartFinancials = useMemo(() => {
    return SalesService.calculateSaleTotals(cartItems, activeDiscount, undefined, taxRate);
  }, [cartItems, activeDiscount, taxRate]);

  const subtotal = cartFinancials.subtotalDollars;
  const discountAmount = cartFinancials.discountDollars;
  const taxAmount = cartFinancials.taxDollars;
  const grandTotal = cartFinancials.grandTotalDollars;

  // Hold order
  const holdCurrentOrder = useCallback((): boolean => {
    if (cartItems.length === 0) {
      showToast({ type: 'warning', title: 'Cannot hold empty cart' });
      return false;
    }

    const held = PosService.holdOrder(
      cartItems,
      activeCustomer,
      currentEmployee,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
      cartNotes
    );

    setHeldOrders(StorageService.getHeldOrders());
    clearCart();
    showToast({
      type: 'info',
      title: `Order Held: ${held.orderNumber}`,
      message: `${held.items.length} items parked safely.`
    });
    return true;
  }, [cartItems, activeCustomer, currentEmployee, subtotal, discountAmount, taxAmount, grandTotal, cartNotes, clearCart, showToast]);

  const resumeOrder = useCallback((heldOrderId: string) => {
    const held = PosService.resumeHeldOrder(heldOrderId);
    if (held) {
      setCartItems(held.items);
      setActiveCustomer(held.customer || null);
      setCartNotes(held.notes || '');
      setHeldOrders(StorageService.getHeldOrders());
      setOpenHeldOrdersModal(false);
      setActiveRoute('pos');
      showToast({ type: 'success', title: `Resumed ${held.orderNumber}` });
    }
  }, [showToast]);

  const deleteHeldOrder = useCallback((heldOrderId: string) => {
    PosService.deleteHeldOrder(heldOrderId);
    setHeldOrders(StorageService.getHeldOrders());
    showToast({ type: 'info', title: 'Held order removed' });
  }, [showToast]);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await SyncEngine.syncNow();
      const pending = await SyncEngine.getPendingCount();
      setPendingSyncCount(pending);
      refreshData();
      if (res.success) {
        showToast({
          type: 'success',
          title: t('sync.success', 'Sync Successful'),
          message: res.uploaded ? `Uploaded ${res.uploaded} changes.` : 'Cloud and local database synchronized.'
        });
      } else {
        showToast({
          type: 'warning',
          title: t('sync.failed', 'Sync Incomplete'),
          message: res.error || 'Operating offline. Changes safely saved locally.'
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: t('sync.error', 'Sync Error'),
        message: err?.message || 'Could not reach server.'
      });
    } finally {
      setIsSyncing(false);
    }
  }, [showToast, refreshData, t]);

  const switchStore = useCallback(async (storeId: string) => {
    const target = availableStores.find(s => s.id === storeId);
    if (!target) return;
    setCurrentStoreId(storeId);
    const updated: StoreSettings = {
      ...settings,
      id: target.id,
      name: target.name,
      address: target.address || settings.address,
      currency: target.currency || settings.currency,
      timezone: target.timezone || settings.timezone
    };
    StorageService.saveSettings(updated);
    setSettings(updated);
    refreshData();
    showToast({
      type: 'info',
      title: 'Store Location Switched',
      message: `Active register now set to "${target.name}".`
    });
  }, [availableStores, settings, refreshData, showToast]);

  const retryFailedSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await SyncEngine.retryFailed();
      const pending = await SyncEngine.getPendingCount();
      setPendingSyncCount(pending);
      refreshData();
      if (res.success) {
        showToast({
          type: 'success',
          title: t('sync.retrySuccess', 'Retry Successful'),
          message: 'Failed changes synchronized.'
        });
      } else {
        showToast({
          type: 'error',
          title: t('sync.retryFailed', 'Retry Failed'),
          message: res.error || 'Server error on retry.'
        });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [showToast, refreshData, t]);

  // Global Keyboard Shortcuts (F1 = POS, F2 = Search, F3 = Customer, F4 = Hold, F5 = Held Orders, F6 = Discount, F7 = Checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPinLocked) return;

      if (e.key === 'F1') {
        e.preventDefault();
        setActiveRoute('pos');
      } else if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('pos-search-input') as HTMLInputElement | null;
        if (searchInput) searchInput.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setOpenCustomerModal(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        holdCurrentOrder();
      } else if (e.key === 'F5') {
        e.preventDefault();
        setOpenHeldOrdersModal(true);
      } else if (e.key === 'F6') {
        e.preventDefault();
        setOpenDiscountModal(true);
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (cartItems.length > 0) {
          setActiveRoute('checkout');
        }
      } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setOpenBarcodeScannerModal(prev => !prev);
      } else if (e.key === 'Escape') {
        setOpenCustomerModal(false);
        setOpenDiscountModal(false);
        setOpenHeldOrdersModal(false);
        setOpenBarcodeScannerModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinLocked, cartItems.length, holdCurrentOrder]);

  return (
    <POSContext.Provider
      value={{
        activeRoute,
        setActiveRoute,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        toggleMobileSidebar,
        currentEmployee,
        switchEmployee,
        isPinLocked,
        setIsPinLocked,
        unlockWithPin,
        isOwner,
        ownerEmployee,
        requireOwnerAuth,
        isOwnerAuthModalOpen,
        ownerAuthTitle,
        closeOwnerAuthModal,
        submitOwnerPin,
        language,
        setLanguage,
        t,
        formatCurrency,
        formatDate,
        formatTime,
        formatNumber,
        dir,
        translateCategoryName,
        translateProductName,
        themeColor,
        setThemeColor,
        currentTheme,
        appearance,
        updateAppearance,
        resetAppearance,
        activeThemeTokens,
        settings,
        updateSettings,
        categories,
        products,
        customers,
        sales,
        inventoryMovements,
        heldOrders,
        discounts,
        taxConfigs,
        employees,
        refreshData,
        cartItems,
        addToCart,
        updateCartItemQty,
        removeCartItem,
        clearCart,
        activeCustomer,
        setActiveCustomer,
        activeDiscount,
        setActiveDiscount,
        cartNotes,
        setCartNotes,
        subtotal,
        discountAmount,
        taxAmount,
        taxRate,
        grandTotal,
        holdCurrentOrder,
        resumeOrder,
        deleteHeldOrder,
        isOffline,
        isSyncing,
        pendingSyncCount,
        triggerSync,
        syncEngineStatus,
        retryFailedSync,
        toasts,
        showToast,
        removeToast,
        openCustomerModal,
        setOpenCustomerModal,
        openDiscountModal,
        setOpenDiscountModal,
        openHeldOrdersModal,
        setOpenHeldOrdersModal,
        openBarcodeScannerModal,
        setOpenBarcodeScannerModal,
        completedSale,
        setCompletedSale,
        accessibility,
        updateAccessibility,
        resetAccessibility,
        announceAccessibility,
        triggerHaptic,
        playAudioCue,
        availableStores,
        currentStoreId,
        switchStore
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = (): POSContextType => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
