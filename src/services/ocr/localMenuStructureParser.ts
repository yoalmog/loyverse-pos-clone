/**
 * AuraPOS - Spanish-Optimized Local Menu Spatial Layout & Structure Detection Parser
 * Conforming to Requirements 1, 4, 5, 6, 7:
 * - Full support for Spanish restaurant menus, accents (á, é, í, ó, ú, ü, ñ, ¿, ¡)
 * - Detects Spanish language from OCR content and activates Spanish-aware parsing
 * - Preserves authentic product names without automatic translation
 * - Stores both originalText and normalizedText for display and dedup
 * - Recognizes Spanish categories (ENTRADAS, PLATOS PRINCIPALES, PIZZAS, HAMBURGUESAS, ENSALADAS, SOPAS, POSTRES, BEBIDAS, COCTELES, CAFÉS, COMBOS, ESPECIALIDADES, PARA COMPARTIR)
 * - Robust LatAm & Spanish price formats: S/ 15, S/15, S/. 15, 15, 15.00, 15,00, $ 15, $15, US$ 15, € 15
 * - Strictly DOES NOT crop or assign menu photographs as product images
 */

import {
  BoundingBox,
  ExtractedCategory,
  ExtractedProduct,
  ExtractedVariant,
  MenuScanResult,
  OcrResult,
  OcrLine
} from '../../types/menuScanner.ts';
import { Category, Product } from '../../types/pos.ts';

// Comprehensive price patterns supporting LATAM (S/., S/, PEN), USD, EUR, etc.
const PRICE_REGEX = /(?:[$€£¥₪₹]|s\/\.?|usd|pen|brl|eur)?\s*([0-9]{1,4}(?:[.,][0-9]{2})?|[0-9]{1,4})\s*(?:usd|pen|brl|eur|[$€£¥₪₹])?/i;
const PURE_PRICE_REGEX = /^(?:[$€£¥₪₹]|s\/\.?|usd|pen|brl|eur)?\s*([0-9]{1,4}(?:[.,][0-9]{2})?)\s*(?:usd|pen|brl|eur|[$€£¥₪₹])?$/i;

// Spanish category terminology (Requirement 5)
const SPANISH_CATEGORY_KEYWORDS = [
  'entradas',
  'platos principales',
  'platos de fondo',
  'fondos',
  'pizzas',
  'hamburguesas',
  'ensaladas',
  'sopas',
  'caldos',
  'postres',
  'bebidas',
  'cocteles',
  'cócteles',
  'cafés',
  'cafes',
  'combos',
  'especialidades',
  'para compartir',
  'piqueos',
  'guarniciones',
  'carnes',
  'parrillas',
  'pastas',
  'mariscos',
  'cebiches',
  'ceviches',
  'sandwiches',
  'sándwiches',
  'alitas',
  'broaster',
  'chicharrones',
  'menú',
  'menu del día',
  'tragos',
  'cervezas',
  'vinos',
  'infusiones',
  'jugos'
];

const INTERNATIONAL_CATEGORY_KEYWORDS = [
  'appetizers',
  'starters',
  'entrees',
  'mains',
  'sides',
  'desserts',
  'drinks',
  'beverages',
  'wines',
  'cocktails',
  'antipasti',
  'primi',
  'secondi',
  'contorni',
  'sobremesas'
];

interface MutableProductState {
  tempId: string;
  name: string;
  originalText: string;
  normalizedText: string;
  categoryName: string;
  description: string;
  price: number;
  isLowConfidence: boolean;
  sourceBoundingBox: BoundingBox;
  extractedText: string;
  originalOcrText: string;
  variants: ExtractedVariant[];
}

export class LocalMenuStructureParser {
  /**
   * Main entry point to parse OCR output with Spanish language detection and 2D spatial layout.
   */
  static parse(
    ocrResult: OcrResult,
    pageNumber: number = 1,
    existingCategories: Category[] = [],
    existingProducts: Product[] = []
  ): MenuScanResult {
    const lines = (ocrResult.lines || []).filter(l => l.text && l.text.trim().length > 0);

    if (lines.length === 0) {
      return {
        detectedCurrency: '$',
        categories: [],
        products: []
      };
    }

    // 1. Detect language from OCR content (Requirement 4)
    const detectedLanguage = this.detectLanguage(ocrResult.fullText);

    // 2. Detect currency (preserving S/, PEN, $, €, etc.) (Requirement 6)
    const detectedCurrency = this.detectCurrency(ocrResult.fullText);

    // Sort lines top-to-bottom, accounting for horizontal baseline alignment
    const sortedLines = [...lines].sort((a, b) => {
      const yDiff = a.boundingBox.top - b.boundingBox.top;
      if (Math.abs(yDiff) < 0.015) {
        return a.boundingBox.left - b.boundingBox.left;
      }
      return yDiff;
    });

    const categories: ExtractedCategory[] = [];
    const products: ExtractedProduct[] = [];

    let currentCategory: ExtractedCategory | null = null;
    let currentProduct: MutableProductState | null = null;

    for (let i = 0; i < sortedLines.length; i++) {
      const line = sortedLines[i];
      const rawText = line.text.trim();

      // Check if line is a Category Heading
      if (this.isCategoryHeading(rawText, line, detectedLanguage)) {
        // Finalize previous product if pending
        if (currentProduct) {
          products.push(this.finalizeProduct(currentProduct, pageNumber, existingProducts, detectedLanguage));
          currentProduct = null;
        }

        const catName = this.cleanHeading(rawText);
        const existingCat = existingCategories.find(
          c => c.name.trim().toLowerCase() === catName.toLowerCase()
        );

        const newCat: ExtractedCategory = {
          id: existingCat ? existingCat.id : `cat_local_${categories.length + 1}_${Date.now()}`,
          tempId: `temp_cat_${categories.length + 1}`,
          name: catName,
          description: existingCat?.description || '',
          color: existingCat?.color || this.getCategoryColor(categories.length),
          iconName: existingCat?.iconName || this.pickCategoryIcon(catName),
          sortOrder: existingCat ? existingCat.sortOrder : categories.length + 1,
          active: true,
          autoPrintKitchen: true,
          productCount: 0,
          sourcePage: pageNumber,
          sourceBoundingBox: line.boundingBox,
          extractedText: rawText,
          selected: true,
          conflictExistingId: existingCat?.id,
          resolution: existingCat ? 'merge_existing' : 'create_new'
        };

        categories.push(newCat);
        currentCategory = newCat;
        continue;
      }

      // Check for Price in line
      const priceResult = this.extractPriceFromLine(line);

      if (priceResult) {
        // Line contains a price
        const namePart = this.removePriceFromLine(rawText, priceResult.token).trim();

        if (namePart.length >= 2) {
          // Line has Name + Price together! (e.g. "Pollo a la brasa ........ S/ 28.00")
          if (currentProduct) {
            products.push(this.finalizeProduct(currentProduct, pageNumber, existingProducts, detectedLanguage));
          }

          const catName = currentCategory?.name || (detectedLanguage === 'es' ? 'Platos Principales' : 'General');
          const cleanedName = this.cleanName(namePart);

          currentProduct = {
            tempId: `prod_local_${products.length + 1}_${Date.now()}`,
            name: cleanedName,
            originalText: cleanedName, // Preserves exact casing and Spanish accents (Requirement 1)
            normalizedText: this.normalizeText(cleanedName), // Lowercase normalized (Requirement 1)
            categoryName: catName,
            description: '',
            price: priceResult.value,
            isLowConfidence: priceResult.isLowConfidence,
            sourceBoundingBox: line.boundingBox,
            extractedText: rawText,
            originalOcrText: rawText,
            variants: []
          };
        } else if (currentProduct && currentProduct.price === 0) {
          // Line is a standalone price for the pending product above it
          currentProduct.price = priceResult.value;
          currentProduct.isLowConfidence = priceResult.isLowConfidence;
          currentProduct.sourceBoundingBox = this.mergeBoundingBoxes(
            currentProduct.sourceBoundingBox,
            line.boundingBox
          );
          currentProduct.originalOcrText += ` | ${rawText}`;
        } else {
          // Multi-size column or variant price
          if (currentProduct) {
            currentProduct.variants.push({
              id: `var_${Date.now()}_${currentProduct.variants.length}`,
              name: `Opción ${currentProduct.variants.length + 1}`,
              price: priceResult.value
            });
          }
        }
      } else {
        // Line does NOT contain a price
        // Could be a Description or a Product Name waiting for price on next line
        if (currentProduct && !currentProduct.description && this.isDescriptionLine(rawText, detectedLanguage)) {
          currentProduct.description = rawText;
          currentProduct.sourceBoundingBox = this.mergeBoundingBoxes(
            currentProduct.sourceBoundingBox,
            line.boundingBox
          );
          currentProduct.originalOcrText += `\n${rawText}`;
        } else if (currentProduct && currentProduct.price > 0) {
          // Product already has price and this is another non-price line -> start new product candidate
          products.push(this.finalizeProduct(currentProduct, pageNumber, existingProducts, detectedLanguage));
          const catName = currentCategory?.name || (detectedLanguage === 'es' ? 'Platos Principales' : 'General');
          const cleanedName = this.cleanName(rawText);

          currentProduct = {
            tempId: `prod_local_${products.length + 1}_${Date.now()}`,
            name: cleanedName,
            originalText: cleanedName,
            normalizedText: this.normalizeText(cleanedName),
            categoryName: catName,
            description: '',
            price: 0,
            isLowConfidence: true,
            sourceBoundingBox: line.boundingBox,
            extractedText: rawText,
            originalOcrText: rawText,
            variants: []
          };
        } else if (currentProduct && currentProduct.price === 0) {
          // Append to product name
          const extra = this.cleanName(rawText);
          currentProduct.name += ` ${extra}`;
          currentProduct.originalText += ` ${extra}`;
          currentProduct.normalizedText = this.normalizeText(currentProduct.name);
          currentProduct.sourceBoundingBox = this.mergeBoundingBoxes(
            currentProduct.sourceBoundingBox,
            line.boundingBox
          );
        } else {
          // Start initial product candidate
          const catName = currentCategory?.name || (detectedLanguage === 'es' ? 'Platos Principales' : 'General');
          const cleanedName = this.cleanName(rawText);

          currentProduct = {
            tempId: `prod_local_${products.length + 1}_${Date.now()}`,
            name: cleanedName,
            originalText: cleanedName,
            normalizedText: this.normalizeText(cleanedName),
            categoryName: catName,
            description: '',
            price: 0,
            isLowConfidence: true,
            sourceBoundingBox: line.boundingBox,
            extractedText: rawText,
            originalOcrText: rawText,
            variants: []
          };
        }
      }
    }

    // Flush last product
    if (currentProduct) {
      products.push(this.finalizeProduct(currentProduct, pageNumber, existingProducts, detectedLanguage));
    }

    // Default category fallback
    if (categories.length === 0 && products.length > 0) {
      const defaultCatName = detectedLanguage === 'es' ? 'Platos Principales' : 'General Menu';
      const defaultCat: ExtractedCategory = {
        id: 'cat_general',
        tempId: 'temp_cat_default',
        name: defaultCatName,
        description: 'Menú principal',
        color: '#2563EB',
        iconName: 'Utensils',
        sortOrder: 1,
        active: true,
        autoPrintKitchen: true,
        productCount: products.length,
        sourcePage: pageNumber,
        selected: true,
        resolution: 'create_new'
      };
      categories.push(defaultCat);
    } else {
      categories.forEach(c => {
        c.productCount = products.filter(p => p.categoryName.toLowerCase() === c.name.toLowerCase()).length;
      });
    }

    return {
      menuTitle: categories[0]?.name ? `${categories[0].name}` : `Menú Página ${pageNumber}`,
      detectedCurrency,
      confidenceScore: products.filter(p => !p.isLowConfidence).length / Math.max(1, products.length),
      categories,
      products
    };
  }

  /**
   * Detects whether the menu is in Spanish by checking accents, punctuation, and keywords (Requirement 4)
   */
  static detectLanguage(text: string): 'es' | 'en' | 'it' | 'other' {
    const lower = text.toLowerCase();

    // Check Spanish accent marks and inverted punctuation: á, é, í, ó, ú, ü, ñ, ¿, ¡
    const spanishAccents = /[áéíóúüñ¿¡]/i.test(text);

    // Common Spanish restaurant tokens
    const spanishMatches = [
      'pollo', 'brasa', 'platos', 'entradas', 'ensalada', 'bebidas',
      'postres', 'hamburguesa', 'papas', 'fritas', 'menú', 'especialidades',
      'ingredientes', 'precio', 'tamaño', 'pequeña', 'mediana', 'grande',
      'con ', 'sin ', 'salsa', 'queso', 'arroz', 'carne', 'chicha', 'cebiche',
      'ceviche', 'lomo', 'costillas', 'porción', 'para compartir'
    ].filter(tok => lower.includes(tok)).length;

    if (spanishAccents || spanishMatches >= 2) {
      return 'es';
    }

    if (lower.includes('antipasti') || lower.includes('pizze') || lower.includes('pasta')) {
      return 'it';
    }

    return 'en';
  }

  /**
   * Detects currency symbol and standard code (Requirement 6)
   */
  static detectCurrency(fullText: string): string {
    if (fullText.includes('S/.') || fullText.includes('S/') || fullText.includes('PEN')) {
      return 'S/';
    }
    if (fullText.includes('€') || fullText.includes('EUR')) {
      return '€';
    }
    if (fullText.includes('£') || fullText.includes('GBP')) {
      return '£';
    }
    if (fullText.includes('R$') || fullText.includes('BRL')) {
      return 'R$';
    }
    return '$';
  }

  /**
   * Identifies category section headings without stripping Spanish accents (Requirement 5)
   */
  private static isCategoryHeading(text: string, line: OcrLine, lang: string): boolean {
    if (text.length < 3 || text.length > 55) return false;

    // Headings never contain prices
    if (this.extractPriceFromLine(line)) return false;

    const lower = text.toLowerCase();

    // Check against Spanish vocabulary list
    if (SPANISH_CATEGORY_KEYWORDS.some(kw => lower.includes(kw))) {
      return true;
    }

    if (INTERNATIONAL_CATEGORY_KEYWORDS.some(kw => lower.includes(kw))) {
      return true;
    }

    // Check uppercase ratio (e.g. "PLATOS PRINCIPALES", "ESPECIALIDADES DE LA CASA")
    const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    if (letters.length >= 5 && letters === letters.toUpperCase()) {
      return true;
    }

    return false;
  }

  /**
   * Checks if line is a descriptive text rather than a title
   */
  private static isDescriptionLine(text: string, lang: string): boolean {
    const lower = text.toLowerCase();
    if (
      text.includes(',') ||
      lower.includes('con ') ||
      lower.includes('acompañado') ||
      lower.includes('servido con') ||
      lower.includes('al estilo') ||
      lower.includes('salsa de') ||
      lower.includes('queso') ||
      lower.includes('with ') ||
      lower.includes('served with')
    ) {
      return true;
    }
    return text.length > 30;
  }

  /**
   * Robust price extractor supporting LatAm S/ 15, S/15, S/. 15, 15.00, 15,00, $ 15
   */
  private static extractPriceFromLine(line: OcrLine): { value: number; token: string; isLowConfidence: boolean } | null {
    const text = line.text.trim();

    // Check elements for localized price tokens
    if (line.elements && line.elements.length > 0) {
      for (let i = line.elements.length - 1; i >= 0; i--) {
        const elem = line.elements[i];
        const match = PURE_PRICE_REGEX.exec(elem.text.trim());
        if (match && match[1]) {
          const numStr = match[1].replace(',', '.');
          const val = parseFloat(numStr);
          if (!isNaN(val) && val > 0 && val < 5000) {
            return {
              value: Math.round(val * 100) / 100,
              token: elem.text.trim(),
              isLowConfidence: (elem.confidence || 1) < 0.7
            };
          }
        }
      }
    }

    // Check full line text
    const match = PRICE_REGEX.exec(text);
    if (match && match[1]) {
      const numStr = match[1].replace(',', '.');
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0 && val < 5000) {
        return {
          value: Math.round(val * 100) / 100,
          token: match[0],
          isLowConfidence: false
        };
      }
    }

    return null;
  }

  private static removePriceFromLine(lineText: string, priceToken: string): string {
    return lineText
      .replace(priceToken, '')
      .replace(/[.·\-]{2,}/g, '') // remove dot leader lines
      .trim();
  }

  /**
   * Cleans heading without stripping Spanish accents or special characters
   */
  private static cleanHeading(text: string): string {
    return text
      .replace(/^[\d\s.\-#*]+/, '')
      .replace(/[\s.\-#*]+$/, '')
      .trim();
  }

  /**
   * Cleans product name while PRESERVING Spanish accents (Requirement 1)
   */
  private static cleanName(text: string): string {
    return text
      .replace(/^[\d\s.\-#*]+/, '')
      .replace(/[.·\-]{2,}/g, '')
      .trim();
  }

  /**
   * Produces lowercase normalized text for searching & deduplication
   */
  private static normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  private static mergeBoundingBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.right, b.right);
    const bottom = Math.max(a.bottom, b.bottom);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  /**
   * Finalizes product with complete separation of Menu Scanning and Product Images (Requirement 7)
   * NEVER imports cropped menu image as product image.
   */
  private static finalizeProduct(
    state: MutableProductState,
    pageNumber: number,
    existingProducts: Product[],
    detectedLanguage: string
  ): ExtractedProduct {
    const warnings: string[] = [];

    if (state.price <= 0) {
      warnings.push(
        detectedLanguage === 'es'
          ? 'Precio no detectado. Verifique el monto.'
          : 'Price missing or low confidence. Please verify.'
      );
      state.isLowConfidence = true;
    }

    // Duplicate detection against existing database
    const exactMatch = existingProducts.find(
      ep => ep.name.trim().toLowerCase() === state.normalizedText
    );

    const partialMatch = !exactMatch
      ? existingProducts.find(
          ep =>
            ep.name.trim().toLowerCase().includes(state.normalizedText) ||
            state.normalizedText.includes(ep.name.trim().toLowerCase())
        )
      : undefined;

    const duplicateMatch = exactMatch ? 'MATCH' : partialMatch ? 'POSSIBLE DUPLICATE' : 'NEW';

    if (duplicateMatch !== 'NEW') {
      warnings.push(
        detectedLanguage === 'es'
          ? `Coincide con producto existente: ${duplicateMatch}`
          : `Matched existing database product: ${duplicateMatch}`
      );
    }

    const matchedExisting = exactMatch || partialMatch;

    // REQUIREMENT 7 & 10:
    // If the product matches an existing catalog item with a REAL upload photo, preserve that.
    // Otherwise DO NOT assign any menu crop. Set to NO_IMAGE and empty imageUrl.
    let initialImageUrl = '';
    let initialImageSource: 'REAL_UPLOAD' | 'AI_GENERATED' | 'NO_IMAGE' = 'NO_IMAGE';

    if (matchedExisting?.imageUrl && matchedExisting.imageSource === 'REAL_UPLOAD') {
      initialImageUrl = matchedExisting.imageUrl;
      initialImageSource = 'REAL_UPLOAD';
    }

    return {
      id: matchedExisting ? matchedExisting.id : `prod_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tempId: state.tempId,
      name: state.name, // Preserved Spanish text and accents (e.g. "Pollo a la brasa")
      originalText: state.originalText,
      normalizedText: state.normalizedText,
      categoryName: state.categoryName,
      price: state.price,
      cost: Math.round(state.price * 0.35 * 100) / 100,
      description: state.description,
      sku: matchedExisting?.sku || `SKU-${state.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      barcode: matchedExisting?.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      unit: matchedExisting?.unit || 'porción',
      stock: 50,
      lowStockThreshold: 10,
      trackInventory: true,
      active: true,
      isFavorite: false,
      // CRITICAL REQUIREMENT 7: DO NOT CROP MENU PHOTO!
      imageUrl: initialImageUrl,
      imageSource: initialImageSource,
      aiImageState: 'idle',
      aiImageHistory: [],
      variants: state.variants,
      modifiers: [],
      sourcePage: pageNumber,
      sourceBoundingBox: state.sourceBoundingBox,
      extractedText: state.extractedText,
      originalOcrText: state.originalOcrText,
      confidence: state.isLowConfidence ? 0.65 : 0.94,
      isLowConfidence: state.isLowConfidence,
      warnings,
      duplicateMatch,
      selected: true,
      conflictType: exactMatch ? 'name_match' : partialMatch ? 'name_match' : 'none',
      conflictExistingId: matchedExisting?.id,
      resolution: exactMatch ? 'update_existing' : 'create_new'
    };
  }

  private static getCategoryColor(index: number): string {
    const colors = [
      '#2563EB', '#7C3AED', '#DB2777', '#EA580C',
      '#16A34A', '#0D9488', '#4F46E5', '#9333EA',
      '#D97706', '#059669', '#E11D48', '#0284C7'
    ];
    return colors[index % colors.length];
  }

  private static pickCategoryIcon(categoryName: string): string {
    const q = categoryName.toLowerCase();
    if (q.includes('pizza')) return 'Pizza';
    if (q.includes('cafe') || q.includes('café')) return 'Coffee';
    if (q.includes('coctel') || q.includes('cóctel') || q.includes('trago') || q.includes('vino')) return 'Wine';
    if (q.includes('cerveza') || q.includes('beer')) return 'Beer';
    if (q.includes('postre') || q.includes('torta')) return 'Cake';
    if (q.includes('ensalada')) return 'Salad';
    if (q.includes('hamburguesa') || q.includes('sandwich')) return 'Sandwich';
    if (q.includes('bebida') || q.includes('jugo') || q.includes('chicha')) return 'CupSoda';
    if (q.includes('sopa') || q.includes('caldo')) return 'Soup';
    if (q.includes('brasa') || q.includes('parrilla') || q.includes('carne')) return 'Flame';
    return 'Utensils';
  }
}
