/**
 * AuraPOS - AI Menu Scanner Types & Data Contracts
 */

export interface BoundingBox {
  left: number; // 0.0 - 1.0 normalized
  top: number; // 0.0 - 1.0 normalized
  right: number; // 0.0 - 1.0 normalized
  bottom: number; // 0.0 - 1.0 normalized
  width: number;
  height: number;
}

export interface OcrElement {
  text: string;
  boundingBox: BoundingBox;
  confidence?: number;
}

export interface OcrLine {
  text: string;
  boundingBox: BoundingBox;
  elements?: OcrElement[];
  confidence?: number;
}

export interface OcrTextBlock {
  text: string;
  boundingBox: BoundingBox;
  lines?: OcrLine[];
  confidence?: number;
  recognizedLanguage?: string;
}

export interface OcrResult {
  fullText: string;
  textBlocks: OcrTextBlock[];
  lines: OcrLine[];
  elements?: OcrElement[];
  imageWidth?: number;
  imageHeight?: number;
  pageNumber?: number;
  detectedLanguage?: string;
  processingTimeMs?: number;
}

export interface ScannedMenuPage {
  id: string;
  name: string;
  dataUrl: string; // Corrected upright display data URL
  originalDataUrl?: string; // Untouched original photo
  correctedDataUrl?: string; // Deskewed and orientation-corrected
  processedOcrDataUrl?: string; // Preprocessed contrast-enhanced grayscale for OCR
  mimeType: string;
  rotation: number; // Current orientation (0, 90, 180, 270)
  autoRotationApplied?: number; // Detected rotation applied automatically
  deskewAngle?: number; // Detected deskew angle
  activeDisplayTab?: 'corrected' | 'original';
  timestamp: string;
  fileSize?: number;
  ocrResult?: OcrResult;
  width?: number;
  height?: number;
}

export interface ExtractedVariant {
  id: string;
  name: string; // e.g. "Small (12oz)", "Large (16oz)"
  price: number;
  sku?: string;
}

export interface ExtractedModifierOption {
  id: string;
  name: string; // e.g. "Extra Cheese", "Oat Milk"
  priceDelta: number; // e.g. 1.50
}

export interface ExtractedModifierGroup {
  id: string;
  name: string; // e.g. "Choice of Milk", "Add-ons", "Spice Level"
  required: boolean;
  min?: number;
  max?: number;
  options: ExtractedModifierOption[];
}

export type ConflictResolution = 'create_new' | 'update_existing' | 'skip';
export type CategoryConflictResolution = 'create_new' | 'merge_existing' | 'skip';

export interface ProductAiImageVersion {
  id: string;
  url: string;
  prompt: string;
  version: number;
  createdAt: string;
}

export interface ExtractedProduct {
  id: string;
  tempId: string;
  name: string;
  originalText: string; // Exact casing and Spanish accents preserved (e.g. "Pollo a la brasa")
  normalizedText: string; // Lowercase normalized for search/dedup (e.g. "pollo a la brasa")
  categoryName: string;
  categoryId?: string;
  price: number;
  cost: number;
  description: string;
  sku: string;
  barcode: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  active: boolean;
  isFavorite: boolean;
  isSpicy?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isAlcoholic?: boolean;
  imageUrl?: string;
  imageSource?: 'REAL_UPLOAD' | 'AI_GENERATED' | 'NO_IMAGE';
  aiImagePrompt?: string;
  aiImageHistory?: ProductAiImageVersion[];
  aiImageState?: 'idle' | 'generating' | 'generated' | 'failed' | 'accepted';
  aiImageError?: string;
  iconName?: string;
  color?: string;
  variants: ExtractedVariant[];
  modifiers: ExtractedModifierGroup[];
  pageIndex?: number;
  sourcePage?: number;
  sourceBoundingBox?: BoundingBox;
  extractedText?: string;
  originalOcrText?: string;
  confidence?: number;
  isLowConfidence?: boolean;
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings?: string[];
  duplicateMatch?: 'NEW' | 'MATCH' | 'POSSIBLE DUPLICATE';
  selected: boolean;
  conflictType?: 'none' | 'name_match' | 'sku_match' | 'barcode_match';
  conflictExistingId?: string;
  resolution: ConflictResolution;
}

export interface ExtractedCategory {
  id: string;
  tempId: string;
  name: string;
  description?: string;
  color: string;
  iconName: string;
  sortOrder: number;
  active: boolean;
  autoPrintKitchen: boolean;
  printerId?: string;
  productCount: number;
  sourcePage?: number;
  sourceBoundingBox?: BoundingBox;
  extractedText?: string;
  warnings?: string[];
  selected: boolean;
  conflictExistingId?: string;
  resolution: CategoryConflictResolution;
}

export interface MenuScanResult {
  menuTitle?: string;
  detectedCurrency?: string;
  confidenceScore?: number;
  notes?: string;
  categories: ExtractedCategory[];
  products: ExtractedProduct[];
}

export interface ImportSummary {
  totalImportedProducts: number;
  totalUpdatedProducts: number;
  totalImportedCategories: number;
  totalUpdatedCategories: number;
  createdCategoryNames: string[];
  createdProductNames: string[];
  updatedProductNames: string[];
  timestamp: string;
}

export type MenuScannerStep = 'capture' | 'analyzing' | 'review' | 'imported';
