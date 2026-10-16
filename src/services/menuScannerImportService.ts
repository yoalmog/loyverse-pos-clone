import { Category, Product, ProductVariant } from '../types/pos.ts';
import {
  ExtractedCategory,
  ExtractedProduct,
  ExtractedVariant,
  ImportSummary,
  MenuScanResult
} from '../types/menuScanner.ts';
import { StorageService } from './storageService.ts';
import { LocalDB } from './db/localDatabase.ts';
import { PRODUCT_IMAGE_PRESETS } from '../utils/productImages.ts';

const CATEGORY_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#EA580C',
  '#16A34A', '#0D9488', '#4F46E5', '#9333EA',
  '#D97706', '#059669', '#E11D48', '#0284C7'
];

export class MenuScannerImportService {
  /**
   * Find matching image preset for an imported item based on its name and category
   */
  static findPresetImage(name: string, categoryName: string): string {
    const q = `${name} ${categoryName}`.toLowerCase();
    
    // Exact/partial match on preset names
    const match = PRODUCT_IMAGE_PRESETS.find(p => {
      const pName = p.name.toLowerCase();
      return q.includes(pName) || pName.split(' ').some(w => w.length > 3 && q.includes(w));
    });

    if (match) return match.url;

    // Fallback based on category keywords
    if (q.includes('coffee') || q.includes('latte') || q.includes('espresso') || q.includes('cappuccino')) {
      return 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('tea') || q.includes('matcha') || q.includes('chai')) {
      return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('burger') || q.includes('sandwich')) {
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('pizza')) {
      return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('pasta') || q.includes('noodle')) {
      return 'https://images.unsplash.com/photo-1621996346565-e3d5d6281005?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('salad') || q.includes('bowl')) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('cake') || q.includes('pastry') || q.includes('dessert') || q.includes('cookie') || q.includes('croissant')) {
      return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=60';
    }
    if (q.includes('cocktail') || q.includes('wine') || q.includes('beer') || q.includes('drink') || q.includes('smoothie')) {
      return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=60';
    }

    return '';
  }

  /**
   * Pre-process raw scan result to reconcile against existing database records
   */
  static processScanResult(
    raw: {
      categories: Array<{
        name: string;
        description?: string;
        color?: string;
        iconName?: string;
        autoPrintKitchen?: boolean;
      }>;
      products: Array<{
        name: string;
        categoryName: string;
        description?: string;
        price: number;
        cost?: number;
        unit?: string;
        sku?: string;
        isSpicy?: boolean;
        isVegetarian?: boolean;
        isGlutenFree?: boolean;
        isAlcoholic?: boolean;
        variants?: Array<{ name: string; price: number; sku?: string }>;
        modifiers?: Array<{ name: string; required?: boolean; options: Array<{ name: string; priceDelta: number }> }>;
      }>;
    },
    existingCategories: Category[],
    existingProducts: Product[]
  ): MenuScanResult {
    // 1. Process Categories
    const categoryMap = new Map<string, ExtractedCategory>();

    (raw.categories || []).forEach((c, idx) => {
      const cleanName = c.name.trim();
      if (!cleanName) return;

      const existing = existingCategories.find(
        ec => ec.name.trim().toLowerCase() === cleanName.toLowerCase()
      );

      const catId = existing ? existing.id : `cat_scan_${Date.now()}_${idx}`;
      const color = c.color || existing?.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
      const iconName = c.iconName || existing?.iconName || 'Package';

      categoryMap.set(cleanName.toLowerCase(), {
        id: catId,
        tempId: `temp_cat_${idx}`,
        name: cleanName,
        description: c.description || existing?.description || '',
        color,
        iconName,
        sortOrder: existing ? existing.sortOrder : existingCategories.length + idx + 1,
        active: true,
        autoPrintKitchen: c.autoPrintKitchen !== undefined ? c.autoPrintKitchen : true,
        printerId: existing?.printerId || undefined,
        productCount: 0,
        selected: true,
        conflictExistingId: existing ? existing.id : undefined,
        resolution: existing ? 'merge_existing' : 'create_new'
      });
    });

    // 2. Process Products and check for missing categories
    const processedProducts: ExtractedProduct[] = [];

    (raw.products || []).forEach((p, idx) => {
      const cleanName = p.name.trim();
      if (!cleanName) return;

      const catName = (p.categoryName || 'General').trim();
      const catKey = catName.toLowerCase();

      // Ensure category exists in categoryMap
      if (!categoryMap.has(catKey)) {
        const existing = existingCategories.find(
          ec => ec.name.trim().toLowerCase() === catKey
        );
        const catId = existing ? existing.id : `cat_scan_${Date.now()}_${categoryMap.size}`;
        categoryMap.set(catKey, {
          id: catId,
          tempId: `temp_cat_${categoryMap.size}`,
          name: catName,
          description: '',
          color: CATEGORY_COLORS[categoryMap.size % CATEGORY_COLORS.length],
          iconName: 'Package',
          sortOrder: existing ? existing.sortOrder : existingCategories.length + categoryMap.size + 1,
          active: true,
          autoPrintKitchen: true,
          productCount: 0,
          selected: true,
          conflictExistingId: existing ? existing.id : undefined,
          resolution: existing ? 'merge_existing' : 'create_new'
        });
      }

      // Increment count
      const categoryEntry = categoryMap.get(catKey)!;
      categoryEntry.productCount += 1;

      // Check product duplicate conflict
      const nameMatch = existingProducts.find(
        ep => ep.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      const skuMatch = p.sku
        ? existingProducts.find(ep => ep.sku.trim().toLowerCase() === p.sku!.trim().toLowerCase())
        : undefined;

      const matchedExisting = nameMatch || skuMatch;
      const conflictType = nameMatch ? 'name_match' : skuMatch ? 'sku_match' : 'none';

      // Safe price & cost formatting
      const rawPrice = Number(p.price) || 0;
      const price = Math.max(0, Math.round(rawPrice * 100) / 100);
      const cost = p.cost !== undefined ? Number(p.cost) : Math.round(price * 0.35 * 100) / 100;

      // Generated SKU / Barcode if not provided
      const autoSku = p.sku || `SKU-${cleanName.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const autoBarcode = matchedExisting?.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

      // Variants conversion
      const variants: ExtractedVariant[] = (p.variants || []).map((v, vIdx) => ({
        id: `var_${Date.now()}_${idx}_${vIdx}`,
        name: v.name,
        price: Number(v.price) || price,
        sku: v.sku || `${autoSku}-V${vIdx + 1}`
      }));

      // Modifiers conversion
      const modifiers = (p.modifiers || []).map((m, mIdx) => ({
        id: `mod_${Date.now()}_${idx}_${mIdx}`,
        name: m.name,
        required: !!m.required,
        options: (m.options || []).map((opt, oIdx) => ({
          id: `opt_${Date.now()}_${idx}_${mIdx}_${oIdx}`,
          name: opt.name,
          priceDelta: Number(opt.priceDelta) || 0
        }))
      }));

      // Separates Menu Scanning from Product Images (Requirement 7)
      // Check if existing product in database had a REAL upload
      let finalImageUrl = '';
      let finalImageSource: 'REAL_UPLOAD' | 'AI_GENERATED' | 'NO_IMAGE' = 'NO_IMAGE';

      if (matchedExisting?.imageUrl && matchedExisting.imageSource === 'REAL_UPLOAD') {
        finalImageUrl = matchedExisting.imageUrl;
        finalImageSource = 'REAL_UPLOAD';
      }

      processedProducts.push({
        id: matchedExisting ? matchedExisting.id : `prod_scan_${Date.now()}_${idx}`,
        tempId: `temp_prod_${idx}`,
        name: cleanName,
        originalText: cleanName,
        normalizedText: cleanName.toLowerCase().trim(),
        categoryName: categoryEntry.name,
        categoryId: categoryEntry.id,
        price,
        cost,
        description: p.description || '',
        sku: autoSku,
        barcode: autoBarcode,
        unit: p.unit || 'porción',
        stock: 50,
        lowStockThreshold: 10,
        trackInventory: true,
        active: true,
        isFavorite: false,
        isSpicy: !!p.isSpicy,
        isVegetarian: !!p.isVegetarian,
        isGlutenFree: !!p.isGlutenFree,
        isAlcoholic: !!p.isAlcoholic,
        imageUrl: finalImageUrl,
        imageSource: finalImageSource,
        aiImageState: 'idle',
        aiImageHistory: [],
        iconName: categoryEntry.iconName,
        color: categoryEntry.color,
        variants,
        modifiers,
        selected: true,
        conflictType,
        conflictExistingId: matchedExisting?.id,
        resolution: matchedExisting ? 'update_existing' : 'create_new'
      });
    });

    return {
      categories: Array.from(categoryMap.values()),
      products: processedProducts
    };
  }

  /**
   * Commit the approved categories and products to the real AuraPOS persistent database
   */
  static async commitImport(
    categoriesToImport: ExtractedCategory[],
    productsToImport: ExtractedProduct[],
    storeId: string = 'store_aura_main'
  ): Promise<ImportSummary> {
    const existingCategories = StorageService.getCategories();
    const existingProducts = StorageService.getProducts();

    const createdCategoryNames: string[] = [];
    const createdProductNames: string[] = [];
    const updatedProductNames: string[] = [];

    const updatedCategoriesList: Category[] = [...existingCategories];
    const categoryIdMapping = new Map<string, string>(); // temp or scanned id -> real committed id

    // 1. Save / Update Categories
    for (const cat of categoriesToImport) {
      if (!cat.selected || cat.resolution === 'skip') continue;

      if (cat.resolution === 'merge_existing' && cat.conflictExistingId) {
        // Merge into existing category
        const idx = updatedCategoriesList.findIndex(c => c.id === cat.conflictExistingId);
        if (idx !== -1) {
          const current = updatedCategoriesList[idx];
          updatedCategoriesList[idx] = {
            ...current,
            description: cat.description || current.description,
            updatedAt: new Date().toISOString()
          };
          categoryIdMapping.set(cat.id, current.id);
          categoryIdMapping.set(cat.name.toLowerCase(), current.id);
          await LocalDB.put('categories', updatedCategoriesList[idx]);
        }
      } else {
        // Create new category
        const newCatId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newCategory: Category = {
          id: newCatId,
          storeId,
          name: cat.name.trim(),
          description: cat.description || '',
          iconName: cat.iconName || 'Package',
          color: cat.color || '#2563EB',
          sortOrder: updatedCategoriesList.length + 1,
          active: true,
          autoPrintKitchen: cat.autoPrintKitchen !== undefined ? cat.autoPrintKitchen : true,
          printerId: cat.printerId || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        updatedCategoriesList.push(newCategory);
        categoryIdMapping.set(cat.id, newCatId);
        categoryIdMapping.set(cat.name.toLowerCase(), newCatId);
        createdCategoryNames.push(newCategory.name);

        await LocalDB.put('categories', newCategory);
        StorageService.logCategoryAudit({
          userId: StorageService.getCurrentEmployee()?.id || 'emp_owner',
          userName: StorageService.getCurrentEmployee()?.name || 'Store Owner',
          categoryId: newCategory.id,
          categoryName: newCategory.name,
          action: 'created',
          details: 'Imported via AI Menu Scanner'
        });
      }
    }

    // Save all categories to localStorage
    StorageService.saveCategories(updatedCategoriesList);

    // 2. Save / Update Products
    const updatedProductsList: Product[] = [...existingProducts];

    for (const prod of productsToImport) {
      if (!prod.selected || prod.resolution === 'skip') continue;

      // Determine real category ID
      const targetCatId =
        categoryIdMapping.get(prod.categoryId || '') ||
        categoryIdMapping.get(prod.categoryName.toLowerCase()) ||
        updatedCategoriesList[0]?.id ||
        'cat_general';

      const convertedVariants: ProductVariant[] = (prod.variants || []).map((v, vIdx) => ({
        id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${vIdx}`,
        productId: '', // assigned below
        name: v.name,
        sku: v.sku || `${prod.sku}-V${vIdx + 1}`,
        price: v.price,
        cost: Math.round(v.price * 0.35 * 100) / 100,
        attributes: { size: v.name },
        active: true,
        stock: 50
      }));

      if (prod.resolution === 'update_existing' && prod.conflictExistingId) {
        // Update existing product
        const pIdx = updatedProductsList.findIndex(p => p.id === prod.conflictExistingId);
        if (pIdx !== -1) {
          const current = updatedProductsList[pIdx];
          const finalImageSource = prod.imageSource || (prod.imageUrl ? 'AI_GENERATED' : current.imageSource || 'NO_IMAGE');
          const updated: Product = {
            ...current,
            name: prod.name,
            categoryId: targetCatId,
            price: prod.price,
            cost: prod.cost,
            description: prod.description || current.description,
            imageUrl: prod.imageUrl || current.imageUrl,
            imageSource: finalImageSource,
            variants: convertedVariants.length > 0
              ? convertedVariants.map(v => ({ ...v, productId: current.id }))
              : current.variants,
            updatedAt: new Date().toISOString()
          };
          updatedProductsList[pIdx] = updated;
          updatedProductNames.push(updated.name);
          await LocalDB.put('products', updated);

          if (prod.imageUrl && finalImageSource === 'AI_GENERATED') {
            StorageService.saveProductImageMetadata({
              imageId: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              productId: current.id,
              source: 'AI_GENERATED',
              url: prod.imageUrl,
              prompt: prod.aiImagePrompt || `Professional food photography of ${prod.name}`,
              createdAt: new Date().toISOString(),
              isCurrent: true
            });
          }
        }
      } else {
        // Create new product
        const newProdId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const finalImageSource = prod.imageSource || (prod.imageUrl ? 'AI_GENERATED' : 'NO_IMAGE');
        const newProduct: Product = {
          id: newProdId,
          storeId,
          categoryId: targetCatId,
          name: prod.name,
          description: prod.description || '',
          sku: prod.sku || `SKU-${Date.now().toString().slice(-4)}`,
          barcode: prod.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
          price: prod.price,
          cost: prod.cost,
          unit: prod.unit || 'porción',
          trackInventory: prod.trackInventory !== undefined ? prod.trackInventory : true,
          stock: prod.stock || 50,
          lowStockThreshold: prod.lowStockThreshold || 10,
          active: true,
          isFavorite: prod.isFavorite || false,
          imageUrl: prod.imageUrl || '',
          imageSource: finalImageSource,
          variants: convertedVariants.map(v => ({ ...v, productId: newProdId })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        updatedProductsList.push(newProduct);
        createdProductNames.push(newProduct.name);
        await LocalDB.put('products', newProduct);

        if (prod.imageUrl && finalImageSource === 'AI_GENERATED') {
          StorageService.saveProductImageMetadata({
            imageId: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            productId: newProdId,
            source: 'AI_GENERATED',
            url: prod.imageUrl,
            prompt: prod.aiImagePrompt || `Professional food photography of ${prod.name}`,
            createdAt: new Date().toISOString(),
            isCurrent: true
          });
        }
      }
    }

    // Save all products to localStorage
    StorageService.saveProducts(updatedProductsList);

    return {
      totalImportedProducts: createdProductNames.length,
      totalUpdatedProducts: updatedProductNames.length,
      totalImportedCategories: createdCategoryNames.length,
      totalUpdatedCategories: categoriesToImport.filter(c => c.resolution === 'merge_existing' && c.selected).length,
      createdCategoryNames,
      createdProductNames,
      updatedProductNames,
      timestamp: new Date().toISOString()
    };
  }
}
