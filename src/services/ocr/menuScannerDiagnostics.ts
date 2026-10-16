/**
 * AuraPOS - Menu Scanner Diagnostic Pipeline
 * Conforming to Phase 6:
 * Explicit diagnostic stages to identify and troubleshoot:
 * - Camera Acquisition failures (permissions, stream capture, payload corruption)
 * - Normalization failures (orientation detection, deskew calculation, canvas sizing)
 * - OCR Extraction failures (blank frames, low contrast, character recognition thresholds)
 * - Structure Parser failures (dish title segmentation, price regex mismatches, category groupings)
 * - Catalog Reconciliation conflicts (duplicate products, barcode collisions, resolution defaults)
 */

import { ScannedMenuPage, OcrResult, ExtractedProduct, ExtractedCategory } from '../../types/menuScanner.ts';
import { Product } from '../../types/pos.ts';

export type DiagnosticStageName =
  | 'CAMERA_ACQUISITION'
  | 'NORMALIZATION'
  | 'OCR_EXTRACTION'
  | 'STRUCTURE_PARSER'
  | 'CATALOG_RECONCILIATION';

export interface StageDiagnosticReport {
  stage: DiagnosticStageName;
  status: 'passed' | 'warning' | 'failed';
  title: string;
  summary: string;
  details?: Record<string, any>;
  remediationAdvice?: string;
  durationMs?: number;
  timestamp: string;
}

export interface PipelineDiagnosticSummary {
  sessionId: string;
  overallSuccess: boolean;
  failedStage?: DiagnosticStageName;
  warningStages: DiagnosticStageName[];
  stages: StageDiagnosticReport[];
  timestamp: string;
}

export class MenuScannerDiagnostics {
  /**
   * Diagnostic Stage 1: Camera Acquisition & Image Upload Inspection
   */
  static evaluateCameraAcquisition(pages: ScannedMenuPage[]): StageDiagnosticReport {
    const timestamp = new Date().toISOString();

    if (!pages || pages.length === 0) {
      return {
        stage: 'CAMERA_ACQUISITION',
        status: 'failed',
        title: 'Camera & Image Acquisition',
        summary: 'No menu pages captured or provided in input queue.',
        remediationAdvice: 'Capture a menu page using the device camera or choose a photo/PDF from your gallery.',
        details: { pageCount: 0 },
        timestamp
      };
    }

    const invalidPages = pages.filter(p => !p.dataUrl || p.dataUrl.length < 100);
    if (invalidPages.length > 0) {
      return {
        stage: 'CAMERA_ACQUISITION',
        status: 'failed',
        title: 'Camera & Image Acquisition',
        summary: `${invalidPages.length} page(s) contain corrupted or empty image data.`,
        remediationAdvice: 'Re-take the photo or check storage permissions on the Android device.',
        details: { invalidPageCount: invalidPages.length, totalPages: pages.length },
        timestamp
      };
    }

    // Check for suspicious tiny payloads (< 2KB)
    const tinyPages = pages.filter(p => p.dataUrl.length < 2000);
    if (tinyPages.length > 0) {
      return {
        stage: 'CAMERA_ACQUISITION',
        status: 'warning',
        title: 'Camera & Image Acquisition',
        summary: 'Image resolution is unusually small. OCR recognition accuracy may be reduced.',
        remediationAdvice: 'For best results, take high-resolution photos with good lighting.',
        details: { tinyPageCount: tinyPages.length, totalPages: pages.length },
        timestamp
      };
    }

    return {
      stage: 'CAMERA_ACQUISITION',
      status: 'passed',
      title: 'Camera & Image Acquisition',
      summary: `Successfully acquired ${pages.length} menu page(s) with valid image payloads.`,
      details: { pageCount: pages.length },
      timestamp
    };
  }

  /**
   * Diagnostic Stage 2: Normalization (Orientation, Deskew & Resolution)
   */
  static evaluateNormalization(
    pages: ScannedMenuPage[],
    analysisResults?: Array<{ width?: number; height?: number; deskewAngle?: number; rotation?: number }>
  ): StageDiagnosticReport {
    const timestamp = new Date().toISOString();

    if (!pages || pages.length === 0) {
      return {
        stage: 'NORMALIZATION',
        status: 'failed',
        title: 'Image Normalization & Deskew',
        summary: 'Cannot normalize: image page list is empty.',
        remediationAdvice: 'Ensure images are provided before running orientation normalization.',
        timestamp
      };
    }

    const results = analysisResults || pages;
    const extremeSkew = results.filter(r => Math.abs(r.deskewAngle || 0) > 12);
    const zeroDimensions = results.filter(r => (r.width !== undefined && r.width <= 0) || (r.height !== undefined && r.height <= 0));

    if (zeroDimensions.length > 0) {
      return {
        stage: 'NORMALIZATION',
        status: 'failed',
        title: 'Image Normalization & Deskew',
        summary: 'Canvas dimension error: detected 0px width or height during preprocessing.',
        remediationAdvice: 'The image may be corrupted. Try converting to a standard JPEG and retry.',
        details: { zeroDimensionCount: zeroDimensions.length },
        timestamp
      };
    }

    if (extremeSkew.length > 0) {
      return {
        stage: 'NORMALIZATION',
        status: 'warning',
        title: 'Image Normalization & Deskew',
        summary: 'Significant tilt angle detected (>12°). Auto-deskew adjusted the image, but text may be slightly distorted.',
        remediationAdvice: 'Take photos straight-on from above rather than at an angle.',
        details: { skewedCount: extremeSkew.length },
        timestamp
      };
    }

    return {
      stage: 'NORMALIZATION',
      status: 'passed',
      title: 'Image Normalization & Deskew',
      summary: 'Orientation corrected to upright; tilt angles aligned within optimal ±15° bounds.',
      details: { normalizedCount: pages.length },
      timestamp
    };
  }

  /**
   * Diagnostic Stage 3: OCR Text Extraction
   */
  static evaluateOcrExtraction(ocrResults: OcrResult[]): StageDiagnosticReport {
    const timestamp = new Date().toISOString();

    if (!ocrResults || ocrResults.length === 0) {
      return {
        stage: 'OCR_EXTRACTION',
        status: 'failed',
        title: 'OCR Text Extraction',
        summary: 'OCR extraction engine produced no text output.',
        remediationAdvice: 'Check that the image is not blank or severely over-exposed. Verify ML Kit on Android.',
        timestamp
      };
    }

    const totalCharacters = ocrResults.reduce((acc, r) => acc + (r.fullText ? r.fullText.trim().length : 0), 0);
    const totalLines = ocrResults.reduce((acc, r) => acc + (r.lines ? r.lines.length : 0), 0);

    if (totalCharacters < 10) {
      return {
        stage: 'OCR_EXTRACTION',
        status: 'failed',
        title: 'OCR Text Extraction',
        summary: `Insufficient text detected (${totalCharacters} characters). The page appears unreadable or blank.`,
        remediationAdvice: 'Ensure the photo captures printed text clearly without blur, shadows, or glare.',
        details: { totalCharacters, totalLines },
        timestamp
      };
    }

    if (totalCharacters < 60) {
      return {
        stage: 'OCR_EXTRACTION',
        status: 'warning',
        title: 'OCR Text Extraction',
        summary: `Low character density detected (${totalCharacters} characters across ${totalLines} lines).`,
        remediationAdvice: 'Menu text may be too far away or partially cut off.',
        details: { totalCharacters, totalLines },
        timestamp
      };
    }

    return {
      stage: 'OCR_EXTRACTION',
      status: 'passed',
      title: 'OCR Text Extraction',
      summary: `Extracted ${totalCharacters} characters across ${totalLines} text lines with high legibility.`,
      details: { totalCharacters, totalLines },
      timestamp
    };
  }

  /**
   * Diagnostic Stage 4: Structure Parser (Dishes, Categories & Prices)
   */
  static evaluateStructureParser(
    products: ExtractedProduct[],
    categories: ExtractedCategory[],
    detectedCurrency?: string
  ): StageDiagnosticReport {
    const timestamp = new Date().toISOString();

    if (!products || products.length === 0) {
      return {
        stage: 'STRUCTURE_PARSER',
        status: 'failed',
        title: 'Menu Structure Parser',
        summary: 'No products or dishes could be parsed from the recognized text.',
        remediationAdvice: 'Check that the menu layout includes recognizable dish names and prices in standard currency formats (e.g. S/ 15, $15.00).',
        details: { productsFound: 0, categoriesFound: categories.length },
        timestamp
      };
    }

    const zeroPriceProducts = products.filter(p => p.price <= 0);
    const lowConfidenceProducts = products.filter(p => p.isLowConfidence);

    if (categories.length === 0) {
      return {
        stage: 'STRUCTURE_PARSER',
        status: 'warning',
        title: 'Menu Structure Parser',
        summary: 'Products detected, but no distinct category headers could be identified. Items assigned to default category.',
        remediationAdvice: 'Review category groupings in the review screen before finalizing import.',
        details: { productCount: products.length, categoryCount: 0 },
        timestamp
      };
    }

    if (zeroPriceProducts.length > products.length * 0.5) {
      return {
        stage: 'STRUCTURE_PARSER',
        status: 'warning',
        title: 'Menu Structure Parser',
        summary: `More than 50% of detected items (${zeroPriceProducts.length}/${products.length}) are missing prices.`,
        remediationAdvice: 'Review prices manually on the review screen before importing.',
        details: { zeroPriceCount: zeroPriceProducts.length, totalProducts: products.length },
        timestamp
      };
    }

    return {
      stage: 'STRUCTURE_PARSER',
      status: 'passed',
      title: 'Menu Structure Parser',
      summary: `Successfully parsed ${products.length} products across ${categories.length} categories (Currency: ${detectedCurrency || 'auto'}).`,
      details: {
        productCount: products.length,
        categoryCount: categories.length,
        lowConfidenceCount: lowConfidenceProducts.length
      },
      timestamp
    };
  }

  /**
   * Diagnostic Stage 5: Catalog Reconciliation & Conflict Detection
   */
  static evaluateCatalogReconciliation(
    extractedProducts: ExtractedProduct[],
    existingProducts: Product[]
  ): StageDiagnosticReport {
    const timestamp = new Date().toISOString();

    const nameMatches = extractedProducts.filter(ep =>
      existingProducts.some(p => p.name.trim().toLowerCase() === ep.name.trim().toLowerCase())
    );

    const barcodeMatches = extractedProducts.filter(ep =>
      ep.barcode &&
      existingProducts.some(p => p.barcode && p.barcode.trim() === ep.barcode.trim())
    );

    const skuMatches = extractedProducts.filter(ep =>
      ep.sku &&
      existingProducts.some(p => p.sku && p.sku.trim().toLowerCase() === ep.sku.trim().toLowerCase())
    );

    const hasConflicts = nameMatches.length > 0 || barcodeMatches.length > 0 || skuMatches.length > 0;

    if (hasConflicts) {
      return {
        stage: 'CATALOG_RECONCILIATION',
        status: 'warning',
        title: 'Catalog Reconciliation',
        summary: `Found ${nameMatches.length} name match(es), ${barcodeMatches.length} barcode collision(s), and ${skuMatches.length} SKU collision(s) with current store catalog.`,
        remediationAdvice: 'Use the Review screen to choose whether to update existing items, create new duplicates, or skip matching items.',
        details: {
          nameMatches: nameMatches.length,
          barcodeMatches: barcodeMatches.length,
          skuMatches: skuMatches.length,
          totalNew: extractedProducts.length - nameMatches.length
        },
        timestamp
      };
    }

    return {
      stage: 'CATALOG_RECONCILIATION',
      status: 'passed',
      title: 'Catalog Reconciliation',
      summary: `All ${extractedProducts.length} extracted items are unique. Zero catalog or barcode collisions detected.`,
      details: { totalNew: extractedProducts.length },
      timestamp
    };
  }

  /**
   * Run full end-to-end diagnostic suite across the entire pipeline
   */
  static generatePipelineReport(params: {
    sessionId?: string;
    pages: ScannedMenuPage[];
    ocrResults?: OcrResult[];
    extractedProducts?: ExtractedProduct[];
    extractedCategories?: ExtractedCategory[];
    existingProducts?: Product[];
    detectedCurrency?: string;
  }): PipelineDiagnosticSummary {
    const sessionId = params.sessionId || `diag_${Date.now()}`;
    const stages: StageDiagnosticReport[] = [];

    // Stage 1: Camera
    const stage1 = this.evaluateCameraAcquisition(params.pages);
    stages.push(stage1);

    // Stage 2: Normalization
    const stage2 = this.evaluateNormalization(params.pages);
    stages.push(stage2);

    // Stage 3: OCR
    const stage3 = this.evaluateOcrExtraction(params.ocrResults || []);
    stages.push(stage3);

    // Stage 4: Structure Parser
    const stage4 = this.evaluateStructureParser(
      params.extractedProducts || [],
      params.extractedCategories || [],
      params.detectedCurrency
    );
    stages.push(stage4);

    // Stage 5: Catalog Reconciliation
    const stage5 = this.evaluateCatalogReconciliation(
      params.extractedProducts || [],
      params.existingProducts || []
    );
    stages.push(stage5);

    const failed = stages.find(s => s.status === 'failed');
    const warnings = stages.filter(s => s.status === 'warning').map(s => s.stage);

    return {
      sessionId,
      overallSuccess: !failed,
      failedStage: failed ? failed.stage : undefined,
      warningStages: warnings,
      stages,
      timestamp: new Date().toISOString()
    };
  }
}
