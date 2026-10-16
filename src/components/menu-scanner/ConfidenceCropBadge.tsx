import React, { useState, useEffect } from 'react';
import { Eye, ZoomIn, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { BoundingBox, ScannedMenuPage } from '../../types/menuScanner.ts';
import { getCropFromBoundingBox } from '../../utils/cropGenerator.ts';
import { usePOS } from '../../context/POSContext.tsx';

interface ConfidenceCropBadgeProps {
  confidence?: number;
  isLowConfidence?: boolean;
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  fieldName?: string;
  fieldValue?: string | number;
  boundingBox?: BoundingBox;
  sourcePage?: number;
  pages: ScannedMenuPage[];
  onCorrectField?: (newValue: string) => void;
}

export const ConfidenceCropBadge: React.FC<ConfidenceCropBadgeProps> = ({
  confidence = 0.9,
  isLowConfidence = false,
  confidenceLevel,
  fieldName = 'Field',
  fieldValue,
  boundingBox,
  sourcePage = 1,
  pages,
  onCorrectField
}) => {
  const { t } = usePOS();
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cropDataUrl, setCropDataUrl] = useState<string | null>(null);
  const [isLoadingCrop, setIsLoadingCrop] = useState(false);

  // Compute effective confidence level
  const effectiveLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
    confidenceLevel ||
    (isLowConfidence || confidence < 0.75
      ? 'LOW'
      : confidence < 0.88
      ? 'MEDIUM'
      : 'HIGH');

  const confPercent = Math.round((confidence || 0.85) * 100);

  // Target page
  const pageIdx = Math.max(0, sourcePage - 1);
  const targetPage = pages[pageIdx] || pages[0];

  // Lazy load crop when hovered or clicked
  useEffect(() => {
    let isCancelled = false;
    if ((isHovered || isExpanded) && !cropDataUrl && targetPage && boundingBox) {
      setIsLoadingCrop(true);
      const imgSource = targetPage.correctedDataUrl || targetPage.originalDataUrl || targetPage.dataUrl;
      getCropFromBoundingBox(imgSource, boundingBox, 0.04)
        .then(url => {
          if (!isCancelled) {
            setCropDataUrl(url);
            setIsLoadingCrop(false);
          }
        })
        .catch(() => {
          if (!isCancelled) setIsLoadingCrop(false);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [isHovered, isExpanded, cropDataUrl, targetPage, boundingBox]);

  // Color styles based on level
  const badgeConfig = {
    HIGH: {
      bg: 'bg-emerald-50 hover:bg-emerald-100/80',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      label: t('menuScanner.confidenceHigh', 'High'),
      icon: CheckCircle
    },
    MEDIUM: {
      bg: 'bg-amber-50 hover:bg-amber-100/80',
      text: 'text-amber-800',
      border: 'border-amber-300',
      dot: 'bg-amber-500 animate-pulse',
      label: t('menuScanner.confidenceMedium', 'Medium'),
      icon: Info
    },
    LOW: {
      bg: 'bg-rose-50 hover:bg-rose-100/80',
      text: 'text-rose-700',
      border: 'border-rose-300',
      dot: 'bg-rose-500 animate-ping',
      label: t('menuScanner.confidenceLow', 'Low'),
      icon: AlertTriangle
    }
  }[effectiveLevel];

  const IconComp = badgeConfig.icon;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Clickable Badge */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setIsExpanded(prev => !prev);
        }}
        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all inline-flex items-center gap-1 cursor-pointer select-none ${badgeConfig.bg} ${badgeConfig.text} ${badgeConfig.border} shadow-2xs active:scale-95`}
        title={`${t('menuScanner.ocrConfidence', 'OCR Confidence')}: ${confPercent}%. ${t('menuScanner.clickToInspectCrop', 'Click to inspect original menu crop')}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dot}`} />
        <span>OCR {confPercent}%</span>
        {effectiveLevel !== 'HIGH' && (
          <span className="opacity-90 underline underline-offset-1 font-semibold">
            {effectiveLevel === 'LOW' ? t('menuScanner.verify', 'Verify') : t('menuScanner.review', 'Review')}
          </span>
        )}
        <Eye className="w-2.5 h-2.5 opacity-75" />
      </button>

      {/* Hover preview tooltip for Medium / Low confidence */}
      {isHovered && !isExpanded && effectiveLevel !== 'HIGH' && (
        <div
          className="absolute z-40 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-2.5 text-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ maxWidth: '90vw' }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5 text-[11px]">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <IconComp className="w-3 h-3 text-amber-400" />
              {t('menuScanner.cropPreview', 'Menu Crop')} ({fieldName})
            </span>
            <span className="text-[10px] text-slate-400">{t('menuScanner.pageLabel', 'Page')} {sourcePage}</span>
          </div>

          {cropDataUrl ? (
            <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800 p-1 flex items-center justify-center min-h-[50px]">
              <img
                src={cropDataUrl}
                alt={t('menuScanner.cropPreview', 'Original Crop')}
                className="max-h-24 w-auto object-contain rounded"
              />
            </div>
          ) : (
            <div className="py-3 text-center text-slate-400 text-[11px]">
              {isLoadingCrop ? t('menuScanner.loadingCrop', 'Loading crop...') : t('menuScanner.clickToInspectCrop', 'Click to inspect crop')}
            </div>
          )}

          <div className="mt-1.5 text-[10px] text-slate-400 text-center">
            {t('menuScanner.cropTip', 'Tap to pin and compare with recognized text')}
          </div>
        </div>
      )}

      {/* Expanded Modal / Floating Popover for Manual Verification */}
      {isExpanded && (
        <div
          onClick={e => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    effectiveLevel === 'LOW'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    {t('menuScanner.manualOcrVerification', 'Manual OCR Verification')}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {fieldName}: {t('menuScanner.confidence', 'Confidence')} {confPercent}% ({badgeConfig.label})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Field Value Display */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {t('menuScanner.ocrRecognizedText', 'OCR Recognized Text')} ({fieldName})
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800">
                  {fieldValue !== undefined ? String(fieldValue) : '—'}
                </div>
              </div>

              {/* Original Menu Crop Preview */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {t('menuScanner.originalMenuCrop', 'Original Menu Photo Crop')} ({t('menuScanner.pageLabel', 'Page')} {sourcePage})
                </label>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center min-h-[120px] max-h-56 overflow-hidden">
                  {cropDataUrl ? (
                    <img
                      src={cropDataUrl}
                      alt={t('menuScanner.originalMenuCrop', 'Original Menu Crop')}
                      className="max-h-48 w-auto object-contain rounded shadow"
                    />
                  ) : (
                    <div className="text-xs text-slate-400">
                      {isLoadingCrop ? t('menuScanner.generatingHighResCrop', 'Generating high-resolution crop...') : t('menuScanner.cropUnavailable', 'Crop not available')}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-blue-50/70 p-3 rounded-xl border border-blue-100 leading-relaxed">
                💡 <span className="font-semibold text-blue-900">{t('menuScanner.verificationTipTitle', 'Verification tip:')}</span> {t('menuScanner.verificationTipBody', 'Compare the photograph crop with the digitized text. You can edit fields directly or accept them as is.')}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {t('common.close', 'Understood / Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
