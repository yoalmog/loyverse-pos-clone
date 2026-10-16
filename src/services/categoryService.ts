import { Category, CategoryTranslation, CategoryAuditLog, Product } from '../types/pos.ts';
import { StorageService } from './storageService.ts';
import { LocalDB } from './db/localDatabase.ts';
import { PrinterRoute } from '../types/printer.ts';

export interface CategoryValidationError {
  field: string;
  message: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  iconName: string;
  imageUrl?: string;
  color: string;
  sortOrder?: number;
  active?: boolean;
  parentId?: string;
  printerId?: string;
  autoPrintKitchen?: boolean;
  defaultLocale?: string;
  translations?: Record<string, { name: string; description?: string }>;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {}

export class CategoryService {
  /**
   * Validate category input according to business rules:
   * - Category name is required.
   * - Do not allow empty category.
   * - Prevent duplicate category names within the same store.
   */
  static validateCategory(
    input: { name?: string },
    excludeId?: string,
    storeId: string = 'store_aura_main'
  ): { valid: boolean; error?: string } {
    if (!input.name || !input.name.trim()) {
      return { valid: false, error: 'Category name is required.' };
    }

    const trimmed = input.name.trim().toLowerCase();
    const existing = StorageService.getCategories();
    const duplicate = existing.find(
      c => c.storeId === storeId && c.id !== excludeId && c.name.trim().toLowerCase() === trimmed
    );

    if (duplicate) {
      return { valid: false, error: 'This category already exists.' };
    }

    return { valid: true };
  }

  /**
   * Get all categories with product counts and optional filtering
   */
  static async getCategories(options?: {
    activeOnly?: boolean;
    search?: string;
  }): Promise<Category[]> {
    let categories: Category[] = [];

    // Try API first
    try {
      const res = await fetch('/api/v1/categories', {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          categories = data;
          // Sync local storage cache
          StorageService.saveCategories(categories);
        }
      }
    } catch {
      // Offline fallback
      categories = StorageService.getCategories();
    }

    if (!categories || categories.length === 0) {
      categories = StorageService.getCategories();
    }

    // Attach real product counts
    const products = StorageService.getProducts();
    const categoriesWithCount = categories.map(cat => ({
      ...cat,
      productCount: products.filter(p => p.categoryId === cat.id).length
    }));

    let result = categoriesWithCount.sort((a, b) => a.sortOrder - b.sortOrder);

    if (options?.activeOnly) {
      result = result.filter(c => c.active);
    }

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      result = result.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return result;
  }

  /**
   * Get single category by ID
   */
  static async getCategoryById(id: string): Promise<Category | null> {
    try {
      const res = await fetch(`/api/v1/categories/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const list = StorageService.getCategories();
    return list.find(c => c.id === id) || null;
  }

  /**
   * Create a new category
   */
  static async createCategory(
    input: CreateCategoryInput,
    userId: string = 'emp_owner',
    userName: string = 'Store Owner',
    storeId: string = 'store_aura_main'
  ): Promise<Category> {
    const val = this.validateCategory(input, undefined, storeId);
    if (!val.valid) {
      throw new Error(val.error || 'Validation failed');
    }

    const categories = StorageService.getCategories();
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder || 0), 0);
    const nowIso = new Date().toISOString();
    const newId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newCategory: Category = {
      id: newId,
      storeId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      iconName: input.iconName || 'Package',
      imageUrl: input.imageUrl?.trim() || undefined,
      color: input.color || '#2563EB',
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : maxOrder + 1,
      active: input.active !== undefined ? input.active : true,
      defaultLocale: input.defaultLocale || 'en',
      parentId: input.parentId || undefined,
      printerId: input.printerId || undefined,
      autoPrintKitchen: input.autoPrintKitchen !== undefined ? input.autoPrintKitchen : true,
      productCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Save to local storage & LocalDB
    categories.push(newCategory);
    StorageService.saveCategories(categories);
    LocalDB.put('categories', newCategory).catch(console.error);

    // Save translations if provided
    if (input.translations) {
      await this.saveCategoryTranslations(newCategory.id, input.translations);
    }

    // Sync printer routing (Requirement 21)
    await this.syncPrinterRouteForCategory(newCategory);

    // Audit log (Requirement 28)
    StorageService.logCategoryAudit({
      userId,
      userName,
      categoryId: newCategory.id,
      categoryName: newCategory.name,
      action: 'created',
      details: `Created category "${newCategory.name}"`
    });

    // Sync with backend API
    try {
      await fetch('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, translations: input.translations })
      });
    } catch {
      // Offline: will sync when online
    }

    return newCategory;
  }

  /**
   * Update existing category
   */
  static async updateCategory(
    id: string,
    input: UpdateCategoryInput,
    userId: string = 'emp_owner',
    userName: string = 'Store Owner',
    storeId: string = 'store_aura_main'
  ): Promise<Category> {
    if (input.name !== undefined) {
      const val = this.validateCategory(input, id, storeId);
      if (!val.valid) {
        throw new Error(val.error || 'Validation failed');
      }
    }

    const categories = StorageService.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`Category not found: ${id}`);
    }

    const existing = categories[index];
    const nowIso = new Date().toISOString();

    const updated: Category = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description.trim() || undefined : existing.description,
      iconName: input.iconName !== undefined ? input.iconName : existing.iconName,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl.trim() || undefined : existing.imageUrl,
      color: input.color !== undefined ? input.color : existing.color,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
      active: input.active !== undefined ? input.active : existing.active,
      parentId: input.parentId !== undefined ? input.parentId || undefined : existing.parentId,
      printerId: input.printerId !== undefined ? input.printerId || undefined : existing.printerId,
      autoPrintKitchen: input.autoPrintKitchen !== undefined ? input.autoPrintKitchen : existing.autoPrintKitchen,
      defaultLocale: input.defaultLocale || existing.defaultLocale || 'en',
      updatedAt: nowIso
    };

    categories[index] = updated;
    StorageService.saveCategories(categories);
    LocalDB.put('categories', updated).catch(console.error);

    // Save translations if provided
    if (input.translations) {
      await this.saveCategoryTranslations(updated.id, input.translations);
    }

    // Sync printer routing (Requirement 21)
    await this.syncPrinterRouteForCategory(updated);

    // Audit log (Requirement 28)
    StorageService.logCategoryAudit({
      userId,
      userName,
      categoryId: updated.id,
      categoryName: updated.name,
      action: 'updated',
      details: `Updated category "${updated.name}"`
    });

    // Sync with backend API
    try {
      await fetch(`/api/v1/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: updated, translations: input.translations })
      });
    } catch {}

    return updated;
  }

  /**
   * Delete category with product safety migration (Requirement 11)
   */
  static async deleteCategory(
    id: string,
    destinationCategoryId?: string,
    userId: string = 'emp_owner',
    userName: string = 'Store Owner'
  ): Promise<{ success: boolean; movedProductsCount: number }> {
    const categories = StorageService.getCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) {
      throw new Error(`Category not found: ${id}`);
    }

    const products = StorageService.getProducts();
    const assignedProducts = products.filter(p => p.categoryId === id);

    if (assignedProducts.length > 0) {
      if (!destinationCategoryId) {
        throw new Error('This category contains products. Please choose a destination category.');
      }
      if (destinationCategoryId === id) {
        throw new Error('Destination category must be different from deleted category.');
      }

      const destCat = categories.find(c => c.id === destinationCategoryId);
      if (!destCat) {
        throw new Error('Selected destination category does not exist.');
      }

      // Migrate all products to destination category
      const updatedProducts = products.map(p => {
        if (p.categoryId === id) {
          return {
            ...p,
            categoryId: destinationCategoryId,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });
      StorageService.saveProducts(updatedProducts);
    }

    // Remove category
    const remainingCategories = categories.filter(c => c.id !== id);
    StorageService.saveCategories(remainingCategories);
    LocalDB.delete('categories', id).catch(console.error);

    // Clean up translations
    const allTranslations = StorageService.getCategoryTranslations().filter(t => t.categoryId !== id);
    StorageService.saveCategoryTranslations(allTranslations);

    // Clean up printer route
    const routes = StorageService.getPrinterRoutes().filter(r => r.categoryId !== id);
    StorageService.savePrinterRoutes(routes);

    // Audit log
    StorageService.logCategoryAudit({
      userId,
      userName,
      categoryId: id,
      categoryName: cat.name,
      action: 'deleted',
      details: assignedProducts.length > 0
        ? `Deleted category "${cat.name}", moved ${assignedProducts.length} product(s) to category "${destinationCategoryId}"`
        : `Deleted category "${cat.name}"`
    });

    // Call API
    try {
      await fetch(`/api/v1/categories/${id}?destinationCategoryId=${destinationCategoryId || ''}`, {
        method: 'DELETE'
      });
    } catch {}

    return { success: true, movedProductsCount: assignedProducts.length };
  }

  /**
   * Activate / Deactivate category (Requirement 10)
   */
  static async setCategoryStatus(
    id: string,
    active: boolean,
    userId: string = 'emp_owner',
    userName: string = 'Store Owner'
  ): Promise<Category> {
    const categories = StorageService.getCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found');

    cat.active = active;
    cat.updatedAt = new Date().toISOString();
    StorageService.saveCategories(categories);
    LocalDB.put('categories', cat).catch(console.error);

    StorageService.logCategoryAudit({
      userId,
      userName,
      categoryId: cat.id,
      categoryName: cat.name,
      action: active ? 'activated' : 'deactivated',
      details: `${active ? 'Activated' : 'Deactivated'} category "${cat.name}"`
    });

    try {
      await fetch(`/api/v1/categories/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
    } catch {}

    return cat;
  }

  /**
   * Reorder categories (Requirement 9 & 27)
   */
  static async reorderCategories(
    orderedCategoryIds: string[],
    userId: string = 'emp_owner',
    userName: string = 'Store Owner'
  ): Promise<Category[]> {
    const categories = StorageService.getCategories();
    const idToOrder = new Map<string, number>();
    orderedCategoryIds.forEach((id, idx) => {
      idToOrder.set(id, idx + 1);
    });

    const updated = categories.map(cat => {
      if (idToOrder.has(cat.id)) {
        return {
          ...cat,
          sortOrder: idToOrder.get(cat.id)!,
          updatedAt: new Date().toISOString()
        };
      }
      return cat;
    }).sort((a, b) => a.sortOrder - b.sortOrder);

    StorageService.saveCategories(updated);
    for (const c of updated) {
      LocalDB.put('categories', c).catch(console.error);
    }

    StorageService.logCategoryAudit({
      userId,
      userName,
      categoryId: orderedCategoryIds[0] || 'all',
      categoryName: 'Reordered list',
      action: 'reordered',
      details: `Reordered ${orderedCategoryIds.length} categories`
    });

    try {
      await fetch('/api/v1/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: orderedCategoryIds })
      });
    } catch {}

    return updated;
  }

  /**
   * Duplicate category (Requirement 2)
   */
  static async duplicateCategory(
    sourceId: string,
    userId: string = 'emp_owner',
    userName: string = 'Store Owner'
  ): Promise<Category> {
    const source = await this.getCategoryById(sourceId);
    if (!source) throw new Error('Category not found');

    const translations = await this.getCategoryTranslationsMap(sourceId);
    const newName = `${source.name} (Copy)`;

    return await this.createCategory(
      {
        name: newName,
        description: source.description,
        iconName: source.iconName,
        imageUrl: source.imageUrl,
        color: source.color,
        sortOrder: (source.sortOrder || 0) + 1,
        active: source.active,
        parentId: source.parentId,
        printerId: source.printerId,
        autoPrintKitchen: source.autoPrintKitchen,
        defaultLocale: source.defaultLocale,
        translations
      },
      userId,
      userName,
      source.storeId
    );
  }

  /**
   * Get products assigned to a category (Requirement 20)
   */
  static getProductsByCategory(categoryId: string): Product[] {
    const products = StorageService.getProducts();
    return products.filter(p => p.categoryId === categoryId);
  }

  /**
   * Multilingual translations helpers (Requirement 5 & 19)
   */
  static async getCategoryTranslationsMap(
    categoryId: string
  ): Promise<Record<string, { name: string; description?: string }>> {
    const all = StorageService.getCategoryTranslations();
    const matches = all.filter(t => t.categoryId === categoryId);
    const map: Record<string, { name: string; description?: string }> = {};
    matches.forEach(m => {
      map[m.locale] = { name: m.name, description: m.description };
    });
    return map;
  }

  static async saveCategoryTranslations(
    categoryId: string,
    translations: Record<string, { name: string; description?: string }>
  ): Promise<void> {
    const all = StorageService.getCategoryTranslations().filter(t => t.categoryId !== categoryId);
    const nowIso = new Date().toISOString();

    for (const [locale, data] of Object.entries(translations)) {
      if (data.name && data.name.trim()) {
        const item: CategoryTranslation = {
          id: `trans_${categoryId}_${locale}`,
          categoryId,
          locale,
          name: data.name.trim(),
          description: data.description?.trim() || undefined,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        all.push(item);
        LocalDB.put('category_translations', item).catch(console.error);
      }
    }

    StorageService.saveCategoryTranslations(all);
  }

  /**
   * Synchronize Category Printer Routing (Requirement 21 & 23)
   */
  static async syncPrinterRouteForCategory(category: Category): Promise<void> {
    const routes = StorageService.getPrinterRoutes().filter(r => r.categoryId !== category.id);

    if (category.printerId) {
      const newRoute: PrinterRoute = {
        id: `route_cat_${category.id}`,
        storeId: category.storeId,
        printerId: category.printerId,
        categoryId: category.id,
        purpose: 'kitchen',
        priority: 2, // Category route precedence (higher than default 1, lower than product 3)
        autoPrint: category.autoPrintKitchen ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      routes.push(newRoute);
    }

    StorageService.savePrinterRoutes(routes);
  }

  /**
   * Create Sample Categories Template (Requirement 26)
   * Only called on explicit user action & confirmation. Never auto-seeded!
   */
  static async createSampleCategories(
    userId: string = 'emp_owner',
    userName: string = 'Store Owner',
    storeId: string = 'store_aura_main'
  ): Promise<Category[]> {
    const samples = [
      {
        name: 'Food',
        description: 'Appetizers, meals, mains and sandwiches',
        iconName: 'Utensils',
        color: '#F59E0B',
        sortOrder: 1,
        autoPrintKitchen: true,
        translations: {
          en: { name: 'Food', description: 'Meals and mains' },
          es: { name: 'Comida', description: 'Platos y comidas' },
          fr: { name: 'Nourriture', description: 'Plats et repas' },
          de: { name: 'Essen', description: 'Hauptgerichte und Mahlzeiten' },
          ar: { name: 'مأكولات', description: 'وجبات وأطباق رئيسية' },
          he: { name: 'אוכל', description: 'מנות וארוחות' },
          zh: { name: '精选美食', description: '正餐与主食小吃' },
          ja: { name: 'フード', description: 'メイン料理とお食事' },
          pt: { name: 'Comida', description: 'Pratos e refeições' }
        }
      },
      {
        name: 'Drinks',
        description: 'Cold beverages, juices, teas and sodas',
        iconName: 'GlassWater',
        color: '#06B6D4',
        sortOrder: 2,
        autoPrintKitchen: true,
        translations: {
          en: { name: 'Drinks', description: 'Beverages and refreshments' },
          es: { name: 'Bebidas', description: 'Refrescos y jugos' },
          fr: { name: 'Boissons', description: 'Boissons fraîches et jus' },
          de: { name: 'Getränke', description: 'Erfrischungen und Säfte' },
          ar: { name: 'مشروبات', description: 'عصائر ومشروبات باردة' },
          he: { name: 'משקאות', description: 'שתייה ומיצים' },
          zh: { name: '特调饮品', description: '清凉冷饮与鲜榨果汁' },
          ja: { name: 'ドリンク', description: 'コールドドリンク＆ジュース' },
          pt: { name: 'Bebidas', description: 'Bebidas e sucos' }
        }
      },
      {
        name: 'Desserts',
        description: 'Cakes, pastries, ice cream and sweets',
        iconName: 'Cake',
        color: '#EC4899',
        sortOrder: 3,
        autoPrintKitchen: true,
        translations: {
          en: { name: 'Desserts', description: 'Sweet treats and cakes' },
          es: { name: 'Postres', description: 'Pasteles y dulces' },
          fr: { name: 'Desserts', description: 'Gâteaux et douceurs' },
          de: { name: 'Desserts', description: 'Kuchen und Süßspeisen' },
          ar: { name: 'حلويات', description: 'كعك وحلويات' },
          he: { name: 'קינוחים', description: 'עוגות ומתוקים' },
          zh: { name: '甜点烘焙', description: '蛋糕甜品与烘焙糕点' },
          ja: { name: 'デザート', description: 'スイーツ＆ケーキ' },
          pt: { name: 'Sobremesas', description: 'Bolos e doces' }
        }
      },
      {
        name: 'Coffee',
        description: 'Espresso, cappuccino, lattes and brewed coffee',
        iconName: 'Coffee',
        color: '#8B5CF6',
        sortOrder: 4,
        autoPrintKitchen: true,
        translations: {
          en: { name: 'Coffee', description: 'Espresso and handcrafted brews' },
          es: { name: 'Café', description: 'Espresso y cafés preparados' },
          fr: { name: 'Café', description: 'Expresso et cafés de spécialité' },
          de: { name: 'Kaffee', description: 'Espresso und Brühkaffee' },
          ar: { name: 'قهوة', description: 'إسبريسو ومشروبات القهوة' },
          he: { name: 'קפה', description: 'אספרסו ומשקאות קפה' },
          zh: { name: '精品咖啡', description: '意式浓缩与手冲咖啡' },
          ja: { name: 'コーヒー', description: 'エスプレッソ＆ドリップ' },
          pt: { name: 'Café', description: 'Espresso e cafés especiais' }
        }
      }
    ];

    const createdList: Category[] = [];
    for (const sample of samples) {
      const created = await this.createCategory(
        {
          name: sample.name,
          description: sample.description,
          iconName: sample.iconName,
          color: sample.color,
          sortOrder: sample.sortOrder,
          active: true,
          autoPrintKitchen: sample.autoPrintKitchen,
          translations: sample.translations
        },
        userId,
        userName,
        storeId
      );
      createdList.push(created);
    }

    return createdList;
  }
}
