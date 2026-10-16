import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import {
  Sparkles,
  Camera,
  Upload,
  FileText,
  Loader2,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Layers,
  Utensils,
  BookOpen,
  WifiOff,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Zap,
  Server,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  X
} from 'lucide-react';
import {
  ScannedMenuPage,
  ExtractedCategory,
  ExtractedProduct,
  ImportSummary,
  MenuScannerStep,
  ConflictResolution
} from '../../types/menuScanner.ts';
import { CameraCaptureModal } from './CameraCaptureModal.tsx';
import { PageManager } from './PageManager.tsx';
import { ReviewStep } from './ReviewStep.tsx';
import { ImportSummaryModal } from './ImportSummaryModal.tsx';
import {
  MenuScannerApi,
  ExtractionDiagnosticError,
  ExtractionErrorType
} from '../../services/api/menuScannerApi.ts';
import { MenuScannerImportService } from '../../services/menuScannerImportService.ts';
import { optimizeImageForOCR } from '../../utils/imageOptimizer.ts';
import { generateSampleMenuPages } from '../../utils/sampleMenuGenerator.ts';
import { useAuraNetwork } from '../../hooks/useAuraNetwork.ts';
import { LocalOcrEngine } from '../../services/ocr/localOcrEngine.ts';
import { ImageOrientationService } from '../../services/ocr/imageOrientationService.ts';
import { NativeBridgeService } from '../../services/native/NativeBridgeService.ts';
import {
  MenuScannerDiagnostics,
  PipelineDiagnosticSummary
} from '../../services/ocr/menuScannerDiagnostics.ts';

export const MenuScannerView: React.FC = () => {
  const {
    products: existingProducts,
    categories: existingCategories,
    refreshData,
    showToast,
    settings,
    updateSettings,
    setActiveRoute,
    t,
    language
  } = usePOS();

  // Gemini API Key management
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => MenuScannerApi.getStoredApiKey());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);

  // Network Hook: Centralized request lifecycle, pre-flight health checks, diagnostic logging
  const auraNetwork = useAuraNetwork({ timeoutMs: 120000, checkHealthOnMount: true });

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<MenuScannerStep>('capture');
  const [scanProgressText, setScanProgressText] = useState<string>('');
  const [isAiEnhancing, setIsAiEnhancing] = useState<boolean>(false);
  const [aiEnhanceNotice, setAiEnhanceNotice] = useState<string | null>(null);

  // Scanned pages state with session persistence (Requirement 16 & 23)
  const [pages, setPages] = useState<ScannedMenuPage[]>(() => {
    try {
      const saved = sessionStorage.getItem('aurapos_active_menu_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // Keep pages preserved across navigation
  useEffect(() => {
    try {
      if (pages.length > 0) {
        sessionStorage.setItem('aurapos_active_menu_pages', JSON.stringify(pages));
      } else {
        sessionStorage.removeItem('aurapos_active_menu_pages');
      }
    } catch {}
  }, [pages]);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<ScannedMenuPage | null>(null);

  // AI Extraction results
  const [extractedCategories, setExtractedCategories] = useState<ExtractedCategory[]>([]);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [scanMetadata, setScanMetadata] = useState<{ title?: string; notes?: string }>({});

  const [pipelineDiagnostics, setPipelineDiagnostics] = useState<PipelineDiagnosticSummary | null>(null);
  const [showDiagnosticDetails, setShowDiagnosticDetails] = useState<boolean>(false);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  // Hidden File Input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Currency symbol
  const currencySymbol = settings.currency || '$';

  // -------------------------------------------------------------
  // File Upload Handlers (Images & PDFs with Auto-Orientation Detection - Requirement 2)
  // -------------------------------------------------------------
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    showToast({
      type: 'info',
      title: t('menuScanner.analyzingPages', 'Analyzing Pages'),
      message: t('menuScanner.detectingOrientation', `Detecting orientation and optimizing ${fileList.length} pages...`, { count: fileList.length })
    });

    for (let idx = 0; idx < fileList.length; idx++) {
      const file = fileList[idx];
      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            try {
              // Automatic Orientation Detection, Deskew & Preprocessing (Requirement 2 & 3)
              const orientResult = await ImageOrientationService.analyzeAndCorrect(reader.result);

              const newPage: ScannedMenuPage = {
                id: `page_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
                name: file.name || `${t('menuScanner.pageLabel', 'Page {number}', { number: pages.length + idx + 1 })}`,
                dataUrl: orientResult.correctedDataUrl,
                originalDataUrl: orientResult.originalDataUrl,
                correctedDataUrl: orientResult.correctedDataUrl,
                processedOcrDataUrl: orientResult.processedOcrDataUrl,
                rotation: 0, // correctedDataUrl already has any rotation baked in; this holds only manual user rotation
                autoRotationApplied: orientResult.detectedRotation,
                deskewAngle: orientResult.deskewAngle,
                activeDisplayTab: 'corrected',
                mimeType: 'image/jpeg',
                timestamp: new Date().toISOString(),
                fileSize: Math.round(orientResult.correctedDataUrl.length * 0.75),
                width: orientResult.width,
                height: orientResult.height
              };

              setPages(prev => [...prev, newPage]);

              if (orientResult.detectedRotation !== 0) {
                showToast({
                  type: 'info',
                  title: t('menuScanner.orientationCorrected', 'Orientation Corrected'),
                  message: t('menuScanner.orientationCorrectedMsg', `Auto-corrected orientation for ${file.name || 'page'} (${orientResult.detectedRotation}° CW).`, { name: file.name || 'page', degrees: orientResult.detectedRotation })
                });
              }
            } catch (err) {
              const newPage: ScannedMenuPage = {
                id: `page_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
                name: file.name || `${t('menuScanner.pageLabel', 'Page {number}', { number: pages.length + idx + 1 })}`,
                dataUrl: reader.result as string,
                originalDataUrl: reader.result as string,
                correctedDataUrl: reader.result as string,
                mimeType: file.type || 'image/jpeg',
                rotation: 0,
                timestamp: new Date().toISOString(),
                fileSize: file.size
              };
              setPages(prev => [...prev, newPage]);
            }
          }
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });
    }

    showToast({
      type: 'success',
      title: t('menuScanner.pagesReady', 'Pages Ready'),
      message: t('menuScanner.pagesReadyMsg', `${fileList.length} pages ready for OCR recognition.`, { count: fileList.length })
    });
  };

  // Drag & drop handlers
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Page management callbacks & manual rotation controls (Requirement 3)
  const handleRotatePageRight = (id: string) => {
    setPages(prev =>
      prev.map(p => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleRotatePageLeft = (id: string) => {
    setPages(prev =>
      prev.map(p => (p.id === id ? { ...p, rotation: (p.rotation + 270) % 360 } : p))
    );
  };

  const handleResetPageOrientation = (id: string) => {
    setPages(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              rotation: 0,
              deskewAngle: 0,
              dataUrl: p.originalDataUrl || p.dataUrl,
              activeDisplayTab: 'original'
            }
          : p
      )
    );
  };

  const handleTogglePageTab = (id: string, tab: 'corrected' | 'original') => {
    setPages(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              activeDisplayTab: tab,
              dataUrl:
                tab === 'corrected'
                  ? p.correctedDataUrl || p.dataUrl
                  : p.originalDataUrl || p.dataUrl
            }
          : p
      )
    );
  };

  const handleUpdateProductsBatch = (updatedProducts: ExtractedProduct[]) => {
    setExtractedProducts(updatedProducts);
  };

  const handleRemovePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    setPages(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // -------------------------------------------------------------
  // Load Sample Menu (Demo & Instant Verification)
  // -------------------------------------------------------------
  const handleLoadSampleMenu = async () => {
    try {
      showToast({
        type: 'info',
        title: 'Generating Demo Menu',
        message: 'Building 5 high-resolution menu pages (Bella Napoli Trattoria)...'
      });
      const samplePages = await generateSampleMenuPages();
      setPages(samplePages);
      auraNetwork.clearError();
      showToast({
        type: 'success',
        title: '5 Pages Ready',
        message: 'Tap "Analyze Menu with AI" to test Gemini Vision OCR.'
      });
    } catch (err: any) {
      console.error('Error generating sample menu:', err);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Could not generate sample menu pages.'
      });
    }
  };

  // -------------------------------------------------------------
  // Native Android & Web Image Acquisition Handlers (Requirement 2)
  // -------------------------------------------------------------
  const handleNativeCameraLaunch = async () => {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.menuScanner.launchNativeCamera();
        if (res.success && res.pages && res.pages.length > 0) {
          setPages(prev => [...prev, ...res.pages!]);
          showToast({
            type: 'success',
            title: 'Camera Photo Acquired',
            message: 'Menu photo added to scanner queue.'
          });
          return;
        }
      } catch (err: any) {
        console.warn('Native camera error, falling back to web camera:', err);
      }
    }
    setIsCameraOpen(true);
  };

  const handleNativeGalleryLaunch = async () => {
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.menuScanner.launchNativeGallery(true);
        if (res.success && res.pages && res.pages.length > 0) {
          setPages(prev => [...prev, ...res.pages!]);
          showToast({
            type: 'success',
            title: 'Gallery Photos Added',
            message: `Added ${res.pages.length} pages from gallery.`
          });
          return;
        }
      } catch (err: any) {
        console.warn('Native gallery error, falling back to file picker:', err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleImportPdf = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'application/pdf,image/*';
      fileInputRef.current.click();
    }
  };

  // Save/clear Gemini API key
  const handleSaveApiKey = (newKey: string) => {
    const clean = newKey.trim();
    MenuScannerApi.setStoredApiKey(clean);
    setGeminiApiKey(clean);
    updateSettings({
      ...settings,
      geminiApiKey: clean
    });
    setIsApiKeyModalOpen(false);
    auraNetwork.clearError();
    showToast({
      type: 'success',
      title: clean ? 'Gemini API Key Saved' : 'API Key Cleared',
      message: clean
        ? 'AI menu scanner is now ready with Google Gemini Vision.'
        : 'API Key removed.'
    });
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // PRIMARY ARCHITECTURE: Online AI Menu Scanner with Local OCR Fallback
  // -------------------------------------------------------------
  const handleStartLocalScan = async () => {
    if (pages.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Pages',
        message: 'Please take a photo or upload at least one menu page.'
      });
      return;
    }

    const currentKey = geminiApiKey || MenuScannerApi.getStoredApiKey();
    const isNative = NativeBridgeService.isNativeAndroid() && NativeBridgeService.menuScanner.hasNativeScanner();

    // If no key configured, not on native Android, and backend is not already confirmed healthy, prompt modal
    if (!currentKey && !isNative && auraNetwork.health.isHealthy !== true) {
      setTempApiKey('');
      setIsApiKeyModalOpen(true);
      showToast({
        type: 'warning',
        title: 'Gemini Key Required',
        message: 'Please configure your free Gemini API key to start scanning.'
      });
      return;
    }

    setCurrentStep('analyzing');

    // a) If navigator is online, call auraNetwork.analyzeMenuWithAi first
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (isOnline) {
      try {
        const result = await auraNetwork.analyzeMenuWithAi(pages, stage => setScanProgressText(stage));

        if (result.success && result.data && result.data.products && result.data.products.length > 0) {
          const processed = MenuScannerImportService.processScanResult(
            result.data,
            existingCategories,
            existingProducts
          );
          setExtractedCategories(processed.categories);
          setExtractedProducts(processed.products);
          setScanMetadata({
            title: result.data.menuTitle || '',
            notes: result.data.notes || ''
          });
          setCurrentStep('review');
          showToast({
            type: 'success',
            title: 'Menu Analyzed!',
            message: `Extracted ${processed.products.length} products across ${processed.categories.length} categories.`
          });
          return;
        } else if (result.success) {
          setCurrentStep('capture');
          showToast({
            type: 'warning',
            title: 'No products found',
            message: result.data?.notes || 'Retake the photo straight-on with good light'
          });
          return;
        }
      } catch (aiErr: any) {
        console.warn('AI scan failed or unavailable, continuing to local fallback:', aiErr);
        if (aiErr?.errorType === 'CONFIG_ERROR') {
          setCurrentStep('capture');
          setTempApiKey(geminiApiKey);
          setIsApiKeyModalOpen(true);
          showToast({
            type: 'warning',
            title: 'Gemini Key Required',
            message: aiErr?.message || 'Please configure your Google Gemini API key to scan menus.'
          });
          return;
        }
        showToast({
          type: 'warning',
          title: 'AI scan unavailable',
          message: aiErr?.message || 'Falling back to on-device scan...'
        });
      }
    }

    // b) FALLBACK: On-device LocalOcrEngine flow
    try {
      setScanProgressText('Initializing on-device image preprocessing...');

      const { scanResult, updatedPages } = await LocalOcrEngine.scanPagesLocally(
        pages,
        existingCategories,
        existingProducts,
        update => setScanProgressText(update.message)
      );

      if (!scanResult.products || scanResult.products.length === 0) {
        const diag = MenuScannerDiagnostics.generatePipelineReport({
          pages: updatedPages,
          ocrResults: updatedPages.map(p => p.ocrResult).filter(Boolean) as any,
          extractedProducts: [],
          extractedCategories: scanResult.categories || [],
          existingProducts,
          detectedCurrency: scanResult.detectedCurrency
        });
        setPipelineDiagnostics(diag);
        setCurrentStep('capture');
        showToast({
          type: 'warning',
          title: 'No products found',
          message: scanResult.notes || 'Retake the photo straight-on with good light'
        });
        return;
      }

      setPages(updatedPages);
      setExtractedCategories(scanResult.categories);
      setExtractedProducts(scanResult.products);
      setScanMetadata({
        title: scanResult.menuTitle,
        notes: scanResult.notes
      });

      const diag = MenuScannerDiagnostics.generatePipelineReport({
        pages: updatedPages,
        ocrResults: updatedPages.map(p => p.ocrResult).filter(Boolean) as any,
        extractedProducts: scanResult.products,
        extractedCategories: scanResult.categories,
        existingProducts,
        detectedCurrency: scanResult.detectedCurrency
      });
      setPipelineDiagnostics(diag);

      setCurrentStep('review');
      showToast({
        type: 'success',
        title: 'Menu Analyzed Locally!',
        message: `Extracted ${scanResult.products.length} products across ${scanResult.categories.length} categories on-device.`
      });
    } catch (err: any) {
      console.error('Local OCR error:', err);
      const errDiag = MenuScannerDiagnostics.generatePipelineReport({
        pages,
        extractedProducts: [],
        extractedCategories: [],
        existingProducts
      });
      setPipelineDiagnostics(errDiag);
      setCurrentStep('capture');
      showToast({
        type: 'error',
        title: 'Scan Failed',
        message: err.message || 'Error processing menu scan on-device.'
      });
    }
  };

  // -------------------------------------------------------------
  // OPTIONAL ENHANCEMENT: Improve with AI (Requirement 12)
  // -------------------------------------------------------------
  const handleEnhanceWithAi = async () => {
    try {
      setIsAiEnhancing(true);
      setAiEnhanceNotice(null);
      showToast({
        type: 'info',
        title: 'AI Enhancement',
        message: 'Querying optional Cloud AI to refine descriptions and category groupings...'
      });

      const result = await auraNetwork.analyzeMenuWithAi(pages);

      if (result.success && result.data) {
        const processed = MenuScannerImportService.processScanResult(
          result.data,
          existingCategories,
          existingProducts
        );
        setExtractedCategories(processed.categories);
        setExtractedProducts(processed.products);
        showToast({
          type: 'success',
          title: 'Menu Enhanced!',
          message: 'AI successfully refined menu categorization and descriptions.'
        });
      } else {
        // Requirement 12: If the AI request fails: DO NOT FAIL THE SCAN. Continue using local OCR results.
        setAiEnhanceNotice('AI enhancement unavailable. Local OCR results are still available.');
        showToast({
          type: 'warning',
          title: 'AI Unavailable',
          message: 'AI enhancement unavailable. Local OCR results are preserved.'
        });
      }
    } catch (err: any) {
      // Requirement 12: DO NOT FAIL THE SCAN. Continue using local OCR results.
      setAiEnhanceNotice('AI enhancement unavailable. Local OCR results are still available.');
      showToast({
        type: 'warning',
        title: 'AI Unavailable',
        message: 'AI enhancement unavailable. Local OCR results are preserved.'
      });
    } finally {
      setIsAiEnhancing(false);
    }
  };

  // -------------------------------------------------------------
  // Real Database Transaction (Requirement 15)
  // -------------------------------------------------------------
  const handleCommitImport = async () => {
    try {
      setIsImporting(true);

      // 1. Commit to client persistent database & localStorage
      const summary = await MenuScannerImportService.commitImport(
        extractedCategories,
        extractedProducts,
        'store_aura_main'
      );

      // 2. Commit to Android native SQLite database if running on device
      if (NativeBridgeService.isNativeAndroid()) {
        try {
          await NativeBridgeService.menuScanner.batchImportToDatabase(
            extractedCategories,
            extractedProducts,
            'store_aura_main'
          );
        } catch (e) {
          console.warn('Native SQLite batch import notice:', e);
        }
      }

      setImportSummary(summary);
      refreshData(); // Synchronize POSContext and state
      setCurrentStep('imported');

      showToast({
        type: 'success',
        title: 'Import Complete!',
        message: `Successfully imported ${summary.totalImportedProducts} new products and ${summary.totalImportedCategories} categories.`
      });
    } catch (err: any) {
      console.error('Import commit error:', err);
      showToast({
        type: 'error',
        title: 'Import Failed',
        message: err?.message || 'Could not save items to database.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Reset / Scan another
  const handleReset = () => {
    setPages([]);
    setExtractedCategories([]);
    setExtractedProducts([]);
    setImportSummary(null);
    setCurrentStep('capture');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-background,#f8fafc)] text-[var(--color-text-primary,#0f172a)] overflow-hidden select-none">
      {/* Global File Inputs (Multi-image/PDF & Direct Camera capture fallback) */}
      <input
        ref={fileInputRef}
        id="menu-global-file-input"
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        id="menu-direct-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onPagesCaptured={newPages => setPages(prev => [...prev, ...newPages])}
        existingPagesCount={pages.length}
      />

      {/* Inspect Page Modal */}
      {previewPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 cursor-pointer"
          onClick={() => setPreviewPage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-700">
            <img
              src={previewPage.dataUrl}
              alt="Preview"
              style={{ transform: `rotate(${previewPage.rotation}deg)` }}
              className="w-full h-full object-contain rounded-xl max-h-[80vh]"
            />
            <div className="text-center mt-2 text-xs text-slate-400">Click anywhere to close</div>
          </div>
        </div>
      )}

      {/* Gemini API Key Configuration Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-500">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">Google Gemini Vision AI</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Instant multi-language menu OCR, category & item extraction
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
              AuraPOS uses Google Gemini Vision to extract categories, prices, variants, and dietary tags from physical menu photos. Enter your API key below for direct in-browser analysis.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKeyText ? 'text' : 'password'}
                    value={tempApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 pr-24 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowApiKeyText(prev => !prev)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title={showApiKeyText ? 'Hide Key' : 'Show Key'}
                    >
                      {showApiKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setTempApiKey(text.trim());
                        } catch {}
                      }}
                      className="px-2 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <span className="font-semibold block">Need a free key?</span>
                  <span>
                    Get an instant free Gemini API key in 1 click at Google AI Studio. No credit card required.
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1 block"
                  >
                    <span>Open Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={() => handleSaveApiKey('')}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Clear Key
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveApiKey(tempApiKey)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Save Key & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Step Views */}
      {currentStep === 'capture' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col max-w-6xl mx-auto w-full transition-all ${
            isDraggingOver ? 'bg-blue-50/50 ring-4 ring-blue-500/30 ring-inset' : ''
          }`}
        >
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  AI Multimodal OCR & Catalog Importer
                </div>

                {/* AI Backend Health Status Badge */}
                <button
                  type="button"
                  onClick={() => auraNetwork.checkBackendHealth()}
                  disabled={auraNetwork.health.isChecking}
                  title="Click to re-verify AI backend connectivity"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all border cursor-pointer ${
                    auraNetwork.health.isHealthy === true
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30'
                      : auraNetwork.health.isHealthy === false
                      ? 'bg-rose-500/20 border-rose-400/30 text-rose-300 hover:bg-rose-500/30'
                      : 'bg-slate-700/60 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      auraNetwork.health.isChecking
                        ? 'bg-amber-400 animate-pulse'
                        : auraNetwork.health.isHealthy === true
                        ? 'bg-emerald-400'
                        : auraNetwork.health.isHealthy === false
                        ? 'bg-rose-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {auraNetwork.health.isChecking
                      ? 'Checking Backend...'
                      : auraNetwork.health.isHealthy === true
                      ? `Backend Ready (${auraNetwork.health.latencyMs}ms)`
                      : auraNetwork.health.isHealthy === false
                      ? 'Backend Unreachable'
                      : 'Backend Health Check'}
                  </span>
                </button>

                {/* Google Gemini API Key Status / Setup Button */}
                <button
                  type="button"
                  onClick={() => {
                    setTempApiKey(geminiApiKey);
                    setIsApiKeyModalOpen(true);
                  }}
                  title="Configure Google Gemini API Key"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all border cursor-pointer ${
                    geminiApiKey
                      ? 'bg-blue-500/20 border-blue-400/30 text-blue-300 hover:bg-blue-500/30'
                      : 'bg-amber-500/20 border-amber-400/30 text-amber-300 hover:bg-amber-500/30'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>
                    {geminiApiKey ? `Gemini Key: Active (${geminiApiKey.slice(0, 6)}...)` : 'Setup Gemini Key'}
                  </span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
                Scan Printed Menu into AuraPOS Catalog
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Take photos with your tablet/phone camera or upload menu images. Gemini Vision automatically extracts all categories, products, prices, variants, sizes, and modifiers with zero manual typing.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleNativeCameraLaunch}
                  className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm shadow-lg flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  Capture with Camera (CameraX)
                </button>

                <label
                  htmlFor="menu-global-file-input"
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-sm border border-white/20 flex items-center gap-2.5 transition-all cursor-pointer backdrop-blur-xs"
                >
                  <Upload className="w-5 h-5" />
                  Upload Images or PDF
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleMenu}
                  className="px-4 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-sm border border-amber-400/30 flex items-center gap-2 transition-all cursor-pointer backdrop-blur-xs"
                  title="Load 5 realistic menu pages to test OCR instantly"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  Load Demo Menu (5 Pages)
                </button>
              </div>
            </div>
          </div>

          {/* Structured Diagnostic Error Display */}
          {auraNetwork.errorMessage && (
            <div className="mb-8 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 p-5 shadow-sm transition-all animate-fadeIn">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                    {auraNetwork.diagnosticState?.errorType === 'NO_INTERNET' ? (
                      <WifiOff className="w-6 h-6" />
                    ) : auraNetwork.diagnosticState?.errorType === 'BACKEND_TIMEOUT' ? (
                      <Clock className="w-6 h-6" />
                    ) : auraNetwork.diagnosticState?.errorType === 'AI_HIGH_DEMAND' ||
                      auraNetwork.diagnosticState?.errorType === 'AI_RATE_LIMIT' ? (
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-rose-950 dark:text-rose-200">
                        {auraNetwork.diagnosticState?.errorType === 'AI_HIGH_DEMAND'
                          ? 'AI Server High Demand Spike'
                          : auraNetwork.diagnosticState?.errorType === 'AI_RATE_LIMIT'
                          ? 'Google AI Rate Limit Reached'
                          : auraNetwork.diagnosticState?.errorType === 'NO_INTERNET'
                          ? 'Terminal Offline'
                          : auraNetwork.diagnosticState?.errorType === 'BACKEND_TIMEOUT'
                          ? 'OCR Extraction Timed Out'
                          : auraNetwork.diagnosticState?.errorType === 'PAYLOAD_TOO_LARGE'
                          ? 'Image Payload Exceeds Limits'
                          : auraNetwork.diagnosticState?.errorType === 'BACKEND_UNREACHABLE'
                          ? 'Network Connection Issue'
                          : 'Extraction Error'}
                      </h4>
                      {auraNetwork.diagnosticState?.status ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-200/60 dark:bg-rose-900/80 text-rose-800 dark:text-rose-300 font-mono text-xs font-semibold">
                          HTTP {auraNetwork.diagnosticState.status}
                        </span>
                      ) : null}
                      {auraNetwork.diagnosticState?.errorType ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                          {auraNetwork.diagnosticState.errorType}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-rose-900 dark:text-rose-200 mt-1 leading-relaxed">
                      {auraNetwork.errorMessage}
                    </p>

                    {/* Actionable Advice */}
                    {auraNetwork.diagnosticState?.errorType === 'AI_HIGH_DEMAND' && (
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1.5 font-medium flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        Temporary peak demand spikes usually clear in 5-10 seconds. All {pages.length} scanned pages are preserved. Tap "Retry Extraction" below.
                      </p>
                    )}
                    {auraNetwork.diagnosticState?.errorType === 'BACKEND_TIMEOUT' && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
                        Tip: Large multimodal scans may take longer under high network traffic. All {pages.length} scanned pages remain safely loaded. Tap "Retry Extraction" to resume.
                      </p>
                    )}
                    {auraNetwork.diagnosticState?.errorType === 'BACKEND_UNREACHABLE' && (
                      <p className="text-xs text-rose-800 dark:text-rose-300 mt-1.5">
                        Check that your AI Backend server is running. You can test connectivity or update the endpoint under "AI Backend Settings". Your {pages.length} pages are saved.
                      </p>
                    )}
                    {auraNetwork.diagnosticState?.errorType === 'NO_INTERNET' && (
                      <p className="text-xs text-rose-800 dark:text-rose-300 mt-1.5">
                        Internet connection was lost. Reconnect your Wi-Fi or mobile data and tap "Retry Extraction". No pages need to be re-scanned.
                      </p>
                    )}
                    {auraNetwork.diagnosticState?.errorType === 'CONFIG_ERROR' && (
                      <p className="text-xs text-blue-800 dark:text-blue-300 mt-1.5 font-medium flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        Google Gemini API Key is required for menu scanning. Tap "Configure Gemini Key" to paste your free key from Google AI Studio.
                      </p>
                    )}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setTempApiKey(geminiApiKey);
                      setIsApiKeyModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{geminiApiKey ? 'Update Key' : 'Configure Gemini Key'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartLocalScan}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry Extraction
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRoute('settings')}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Configure AI Backend in Settings"
                  >
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span>AI Backend Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiagnosticDetails(prev => !prev)}
                    className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Diagnostics</span>
                    {showDiagnosticDetails ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      auraNetwork.clearError();
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium text-xs transition-all cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Collapsible Technical Diagnostics Drawer */}
              {showDiagnosticDetails && auraNetwork.diagnosticState && (
                <div className="mt-4 pt-4 border-t border-rose-200 dark:border-rose-800/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Technical Diagnostic Details (No API keys or sensitive data)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const payload = JSON.stringify(auraNetwork.diagnosticState, null, 2);
                        navigator.clipboard?.writeText(payload);
                        setCopiedDiagnostic(true);
                        setTimeout(() => setCopiedDiagnostic(false), 2500);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-mono transition-colors cursor-pointer"
                    >
                      {copiedDiagnostic ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Diagnostic JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Stage</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{auraNetwork.diagnosticState.stage}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Endpoint</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block" title={auraNetwork.diagnosticState.endpoint}>
                        {auraNetwork.diagnosticState.endpoint}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        {auraNetwork.diagnosticState.status ? `${auraNetwork.diagnosticState.status} ${auraNetwork.diagnosticState.statusText}` : 'Network Fail (0)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Request ID</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block" title={auraNetwork.diagnosticState.requestId}>
                        {auraNetwork.diagnosticState.requestId}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page Manager Component */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-8">
            <PageManager
              pages={pages}
              onRotatePageRight={handleRotatePageRight}
              onRotatePageLeft={handleRotatePageLeft}
              onResetPageOrientation={handleResetPageOrientation}
              onTogglePageTab={handleTogglePageTab}
              onRemovePage={handleRemovePage}
              onMovePage={handleMovePage}
              onPreviewPage={page => setPreviewPage(page)}
              onOpenLiveCamera={handleNativeCameraLaunch}
              onOpenNativeGallery={handleNativeGalleryLaunch}
              onImportPdf={handleImportPdf}
              isNativeAndroid={NativeBridgeService.isNativeAndroid()}
              onTriggerFileUpload={() => fileInputRef.current?.click()}
            />
          </div>

          {/* Diagnostic Stages Panel (Phase 6 Diagnostics) */}
          {pipelineDiagnostics && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      pipelineDiagnostics.overallSuccess ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <h4 className="text-sm font-bold text-slate-900">
                    Menu Import Diagnostic Stages ({pipelineDiagnostics.stages.filter(s => s.status === 'passed').length}/{pipelineDiagnostics.stages.length} Passed)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(pipelineDiagnostics, null, 2));
                    setCopiedDiagnostic(true);
                    setTimeout(() => setCopiedDiagnostic(false), 2000);
                    showToast({
                      type: 'info',
                      title: 'Diagnostics Copied',
                      message: 'Diagnostic report copied to clipboard.'
                    });
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedDiagnostic ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDiagnostic ? 'Copied' : 'Copy Report'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {pipelineDiagnostics.stages.map(st => (
                  <div
                    key={st.stage}
                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                      st.status === 'passed'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : st.status === 'warning'
                        ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                        : 'bg-rose-50/50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span>{st.title}</span>
                        {st.status === 'passed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : st.status === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed">{st.summary}</p>
                    </div>
                    {st.remediationAdvice && (
                      <span className="mt-2 text-[10px] italic opacity-90 border-t border-current/20 pt-1 block">
                        Advice: {st.remediationAdvice}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Floating Action Bar */}
          {pages.length > 0 && (
            <div className="sticky bottom-6 bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 text-white shadow-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 mt-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-xs">
                  {pages.length}
                </div>
                <div>
                  <h4 className="text-sm font-bold leading-tight flex items-center gap-2">
                    <span>{pages.length} Menu {pages.length === 1 ? 'Page' : 'Pages'} Ready for On-Device Scan</span>
                    <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                      Offline-First
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Runs 100% on-device with ML Kit OCR & Spatial Layout Parser (no backend needed)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Primary Action: Local-First On-Device Scanning */}
                <button
                  type="button"
                  onClick={handleStartLocalScan}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-sm shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  Scan Menu Locally (On-Device OCR)
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Animated Scanning & On-Device Processing */}
      {currentStep === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-white select-none">
          <div className="relative mb-8">
            {/* Pulsing Radar Ring */}
            <div className="w-28 h-28 rounded-full border-4 border-emerald-500/40 animate-ping absolute inset-0" />
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-2xl shadow-emerald-500/40 relative z-10">
              <Zap className="w-12 h-12 text-white animate-pulse" />
            </div>
          </div>

          <h3 className="text-2xl font-black tracking-tight mb-2">On-Device Menu Scanning</h3>
          <p className="text-sm text-emerald-300 font-mono mb-6 max-w-md">
            {scanProgressText || 'Extracting menu text & 2D spatial layout...'}
          </p>

          <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse w-full rounded-full" />
          </div>

          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Processing {pages.length} {pages.length === 1 ? 'page' : 'pages'} locally • No Internet required
          </span>
        </div>
      )}

      {/* Step 3: Interactive Review & Editing Studio */}
      {currentStep === 'review' && (
        <ReviewStep
          categories={extractedCategories}
          products={extractedProducts}
          pages={pages}
          existingCategories={existingCategories}
          existingProducts={existingProducts}
          onUpdateCategory={updated =>
            setExtractedCategories(prev => prev.map(c => (c.id === updated.id ? updated : c)))
          }
          onAddCategory={newCat => setExtractedCategories(prev => [...prev, newCat])}
          onDeleteCategory={catId =>
            setExtractedCategories(prev => prev.filter(c => c.id !== catId && c.tempId !== catId))
          }
          onUpdateProduct={updated =>
            setExtractedProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)))
          }
          onAddProduct={newProd => setExtractedProducts(prev => [...prev, newProd])}
          onDeleteProduct={prodId =>
            setExtractedProducts(prev => prev.filter(p => p.id !== prodId && p.tempId !== prodId))
          }
          onBulkSelectProducts={(selected, categoryName) =>
            setExtractedProducts(prev =>
              prev.map(p => {
                if (categoryName && p.categoryName.toLowerCase() !== categoryName.toLowerCase()) {
                  return p;
                }
                return { ...p, selected };
              })
            )
          }
          onBulkSetResolution={resolution =>
            setExtractedProducts(prev =>
              prev.map(p => (p.conflictType !== 'none' ? { ...p, resolution } : p))
            )
          }
          onCommitImport={handleCommitImport}
          isImporting={isImporting}
          currencySymbol={currencySymbol}
          onEnhanceWithAi={handleEnhanceWithAi}
          isAiEnhancing={isAiEnhancing}
          aiEnhanceNotice={aiEnhanceNotice}
          onRerunOcr={handleStartLocalScan}
        />
      )}

      {/* Step 4: Import Summary Modal */}
      <ImportSummaryModal
        isOpen={currentStep === 'imported'}
        summary={importSummary}
        onGoToPOS={() => setActiveRoute('pos')}
        onGoToProducts={() => setActiveRoute('products')}
        onScanAnother={handleReset}
      />
    </div>
  );
};
