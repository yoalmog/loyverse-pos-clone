import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Product, ProductVariant } from '../../types/pos.ts';
import { ProductRepository, BarcodeLookupResult } from '../../services/repositories/ProductRepository.ts';
import { AudioFeedbackService } from '../../utils/audioFeedback.ts';
import { NativeBridgeService } from '../../services/native/NativeBridgeService.ts';
import {
  Camera,
  X,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Layers,
  Sparkles,
  Zap,
  RefreshCw
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSelected?: (product: Product, variant?: ProductVariant) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onProductSelected
}) => {
  const { currentStoreId, addToCart, showToast, t, settings } = usePOS();

  const [manualCode, setManualCode] = useState<string>('');
  const [matchResult, setMatchResult] = useState<BarcodeLookupResult | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [autoAddOnScan, setAutoAddOnScan] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopFrameRef = useRef<number | null>(null);

  const stopCameraStream = useCallback(() => {
    if (scanLoopFrameRef.current) {
      cancelAnimationFrame(scanLoopFrameRef.current);
      scanLoopFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const handleProcessBarcode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      setLastScannedCode(trimmed);
      setSearchStatus('searching');

      try {
        const result = await ProductRepository.lookupBarcode(trimmed, currentStoreId);

        if (result) {
          AudioFeedbackService.playBarcodeSuccess();
          setMatchResult(result);
          setSearchStatus('found');

          if (autoAddOnScan) {
            if (result.matchedVariant) {
              addToCart(result.product, result.matchedVariant, 1);
            } else if (!result.product.variants || result.product.variants.length === 0) {
              addToCart(result.product, undefined, 1);
            }
            showToast({
              type: 'success',
              title: t('barcode.scannedTitle', 'Barcode Scanned'),
              message: `${result.product.name} ${result.matchedVariant ? `(${result.matchedVariant.name})` : ''} added to cart.`
            });
          }

          if (onProductSelected) {
            onProductSelected(result.product, result.matchedVariant);
          }
        } else {
          AudioFeedbackService.playBarcodeError();
          setMatchResult(null);
          setSearchStatus('not_found');
          showToast({
            type: 'warning',
            title: t('barcode.notFoundTitle', 'Product Not Found'),
            message: `No product registered with barcode or SKU: "${trimmed}"`
          });
        }
      } catch (err: any) {
        setSearchStatus('not_found');
        console.error('Barcode lookup error:', err);
      }
    },
    [currentStoreId, autoAddOnScan, addToCart, onProductSelected, showToast, t]
  );

  // Initialize camera and BarcodeDetector loop
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setManualCode('');
      setMatchResult(null);
      setSearchStatus('idle');
      setCameraError(null);
      return;
    }

    let isMounted = true;

    // 1. Android Native Scanner listener
    const stopNativeScanner = NativeBridgeService.barcode.startScanner((code: string) => {
      if (isMounted) {
        handleProcessBarcode(code);
      }
    });

    // 2. Web MediaDevices Camera setup
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera access not supported in this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraActive(true);
        }

        // 3. Web BarcodeDetector API if available
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
            });

            let lastScanTime = 0;

            const detectFrame = async () => {
              if (!isMounted || !videoRef.current) return;
              const now = Date.now();

              if (now - lastScanTime > 300 && videoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0) {
                    const firstCode = barcodes[0].rawValue;
                    if (firstCode && firstCode !== lastScannedCode) {
                      lastScanTime = now;
                      handleProcessBarcode(firstCode);
                    }
                  }
                } catch (_) {}
              }

              scanLoopFrameRef.current = requestAnimationFrame(detectFrame);
            };

            scanLoopFrameRef.current = requestAnimationFrame(detectFrame);
          } catch (_) {
            // Detector failed to initialize, manual fallback remains available
          }
        }
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setCameraError(err.message || 'Camera permission denied or camera device in use.');
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCameraStream();
      stopNativeScanner();
    };
  }, [isOpen, handleProcessBarcode, stopCameraStream, lastScannedCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--theme-border)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--theme-text-primary)]">
                {t('barcode.modalTitle', 'Barcode & QR Scanner')}
              </h2>
              <p className="text-xs text-[var(--theme-text-secondary)]">
                {t('barcode.modalSubtitle', 'Scan product barcodes with camera or enter code manually')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface-variant)] transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Camera Viewfinder */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-[var(--theme-border)] shadow-inner">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isCameraActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Target Reticle & Laser Sweep Animation */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-3/4 h-3/5 border-2 border-dashed border-blue-400/80 rounded-xl">
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500" />

                  {/* Horizontal animated sweep line */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                </div>
              </div>
            )}

            {/* Camera Fallback / Error notice */}
            {(!isCameraActive || cameraError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-900/90">
                <Camera className="w-10 h-10 mb-2 text-slate-500" />
                <p className="text-xs font-medium text-slate-300 max-w-xs">
                  {cameraError || 'Initializing camera stream...'}
                </p>
                <span className="text-[11px] text-slate-500 mt-1">
                  You can still enter barcodes manually below or use a USB/Bluetooth scanner.
                </span>
              </div>
            )}
          </div>

          {/* Manual Barcode Input Form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleProcessBarcode(manualCode);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary)]" />
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder={t('barcode.inputPlaceholder', 'Enter or scan barcode / SKU...')}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-[var(--theme-surface-variant)] border border-[var(--theme-border)] rounded-xl text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim() || searchStatus === 'searching'}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {searchStatus === 'searching' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{t('common.search', 'Search')}</span>
            </button>
          </form>

          {/* Auto-Add Option Toggle */}
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--theme-surface-variant)] rounded-xl text-xs border border-[var(--theme-border)]">
            <span className="text-[var(--theme-text-secondary)] font-medium">
              {t('barcode.autoAddPrompt', 'Auto-add item to cart when scanned')}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoAddOnScan}
                onChange={e => setAutoAddOnScan(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Result Preview Card */}
          {searchStatus === 'found' && matchResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                      {matchResult.product.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--theme-text-secondary)] mt-0.5">
                      <span>SKU: {matchResult.matchedVariant?.sku || matchResult.product.sku}</span>
                      {matchResult.matchedVariant && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                          Variant: {matchResult.matchedVariant.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-black font-mono text-emerald-600">
                  ${(matchResult.matchedVariant?.price ?? matchResult.product.price).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (matchResult.matchedVariant) {
                      addToCart(matchResult.product, matchResult.matchedVariant, 1);
                    } else {
                      addToCart(matchResult.product, undefined, 1);
                    }
                    showToast({
                      type: 'success',
                      title: 'Added',
                      message: `${matchResult.product.name} added to cart.`
                    });
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('barcode.addAgain', 'Add to Cart (+1)')}</span>
                </button>
              </div>
            </div>
          )}

          {searchStatus === 'not_found' && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {t('barcode.noItemFound', `No catalog item matches code "${lastScannedCode}". Check digit accuracy or add product in Catalog.`)}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[var(--theme-border)] bg-[var(--theme-surface-variant)] flex items-center justify-between text-xs text-[var(--theme-text-secondary)]">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-blue-500" />
            <span>Supported: EAN-13, UPC-A, Code 128, QR Code</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[var(--theme-border)] hover:bg-[var(--theme-surface)] text-[var(--theme-text-primary)] font-medium transition-colors cursor-pointer"
          >
            {t('common.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};
