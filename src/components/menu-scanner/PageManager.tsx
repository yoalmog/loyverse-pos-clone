import React from 'react';
import {
  RotateCw,
  RotateCcw,
  Trash2,
  MoveLeft,
  MoveRight,
  Eye,
  Plus,
  Camera,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  Undo2
} from 'lucide-react';
import { ScannedMenuPage } from '../../types/menuScanner.ts';
import { usePOS } from '../../context/POSContext.tsx';

interface PageManagerProps {
  pages: ScannedMenuPage[];
  onRotatePageRight: (id: string) => void;
  onRotatePageLeft: (id: string) => void;
  onResetPageOrientation: (id: string) => void;
  onTogglePageTab: (id: string, tab: 'corrected' | 'original') => void;
  onRemovePage: (id: string) => void;
  onMovePage: (index: number, direction: 'left' | 'right') => void;
  onPreviewPage: (page: ScannedMenuPage) => void;
  onOpenLiveCamera: () => void;
  onTriggerFileUpload: () => void;
  onOpenNativeGallery?: () => void;
  onImportPdf?: () => void;
  isNativeAndroid?: boolean;
}

export const PageManager: React.FC<PageManagerProps> = ({
  pages,
  onRotatePageRight,
  onRotatePageLeft,
  onResetPageOrientation,
  onTogglePageTab,
  onRemovePage,
  onMovePage,
  onPreviewPage,
  onOpenLiveCamera,
  onTriggerFileUpload,
  onOpenNativeGallery,
  onImportPdf,
  isNativeAndroid
}) => {
  const { t } = usePOS();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 text-base">
            {t('menuScanner.menuPages', `Menu Pages (${pages.length})`, { count: pages.length })}
          </h3>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {isNativeAndroid
              ? t('menuScanner.ocrReadyNative', 'Native Android OCR Ready')
              : t('menuScanner.ocrReadyLocal', 'Local OCR Engine Ready')}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenLiveCamera}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            {t('menuScanner.openCamera', 'Camera')}
          </button>
          {onOpenNativeGallery && (
            <button
              type="button"
              onClick={onOpenNativeGallery}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 border border-indigo-200 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('menuScanner.gallery', 'Gallery')}
            </button>
          )}
          {onImportPdf && (
            <button
              type="button"
              onClick={onImportPdf}
              className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1.5 border border-amber-200 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              {t('menuScanner.pdfMenu', 'PDF Menu')}
            </button>
          )}
          <label
            htmlFor="menu-global-file-input"
            onClick={onTriggerFileUpload}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {t('menuScanner.uploadPhoto', 'Upload Photo')}
          </label>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <FileText className="w-8 h-8" />
          </div>
          <h4 className="text-base font-semibold text-slate-900 mb-1">
            {t('menuScanner.noPagesYet', 'No Pages Added Yet')}
          </h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            {t('menuScanner.noPagesDesc', 'Take photos of your restaurant menu or upload scanned images to get started.')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenLiveCamera}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              {t('menuScanner.openCamera', 'Camera')}
            </button>
            <label
              htmlFor="menu-global-file-input"
              onClick={onTriggerFileUpload}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium border border-slate-300 shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {t('menuScanner.uploadPhoto', 'Upload Photo')}
            </label>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pages.map((page, idx) => {
            const isShowingCorrected = page.activeDisplayTab !== 'original';
            const displayUrl = isShowingCorrected
              ? page.correctedDataUrl || page.dataUrl
              : page.originalDataUrl || page.dataUrl;

            return (
              <div
                key={page.id}
                className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {/* Header with Page Number and Auto-Orientation Badge */}
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('menuScanner.pageLabel', `Page ${idx + 1}`, { number: idx + 1 })}
                  </span>
                  {page.autoRotationApplied !== undefined && page.autoRotationApplied !== 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Auto {page.autoRotationApplied}°
                    </span>
                  )}
                </div>

                {/* Tab Switcher: "Original" vs "Corrected for scanning" */}
                <div className="px-2 pt-2 bg-slate-50/50 flex items-center justify-center">
                  <div className="inline-flex rounded-lg bg-slate-200 p-0.5 text-[11px] w-full">
                    <button
                      type="button"
                      onClick={() => onTogglePageTab(page.id, 'corrected')}
                      className={`flex-1 py-1 rounded-md font-medium text-center transition-colors cursor-pointer ${
                        isShowingCorrected
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('menuScanner.correctedImage', 'Corrected')} ({page.rotation || 0}°)
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePageTab(page.id, 'original')}
                      className={`flex-1 py-1 rounded-md font-medium text-center transition-colors cursor-pointer ${
                        !isShowingCorrected
                          ? 'bg-slate-700 text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('menuScanner.originalImage', 'Original')}
                    </button>
                  </div>
                </div>

                {/* Image Preview Canvas */}
                <div
                  className="relative h-52 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => onPreviewPage(page)}
                >
                  <img
                    src={displayUrl}
                    alt={page.name}
                    className="w-full h-full object-contain transition-transform duration-200 bg-slate-900/5"
                  />

                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                    <Eye className="w-5 h-5 drop-shadow" />
                    <span className="text-xs font-medium drop-shadow">{t('common.preview', 'Preview')}</span>
                  </div>
                </div>

                {/* Manual Orientation Adjustment Toolbar */}
                <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1 text-slate-700">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onRotatePageLeft(page.id)}
                      className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-[11px] font-semibold border border-slate-300/80 bg-white shadow-2xs"
                      title={t('menuScanner.rotateLeft', 'Rotate Left')}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                      -90°
                    </button>
                    <button
                      type="button"
                      onClick={() => onRotatePageRight(page.id)}
                      className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-[11px] font-semibold border border-slate-300/80 bg-white shadow-2xs"
                      title={t('menuScanner.rotateRight', 'Rotate Right')}
                    >
                      <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                      +90°
                    </button>
                    <button
                      type="button"
                      onClick={() => onResetPageOrientation(page.id)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                      title={t('menuScanner.resetOrientation', 'Reset Orientation')}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMovePage(idx, 'left')}
                      className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
                      title={t('menuScanner.moveLeft', 'Move Left')}
                    >
                      <MoveLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => onMovePage(idx, 'right')}
                      className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
                      title={t('menuScanner.moveRight', 'Move Right')}
                    >
                      <MoveRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemovePage(page.id)}
                      className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors"
                      title={t('menuScanner.deletePage', 'Remove Page')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Another Page Card */}
          <div className="h-64 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 flex flex-col items-center justify-center p-4 text-center transition-all">
            <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-600 mb-2">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-slate-800 mb-1">
              {t('menuScanner.addAnotherPage', 'Add Another Page')}
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={onOpenLiveCamera}
                className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium transition-colors cursor-pointer"
                title={t('menuScanner.openCamera', 'Camera')}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <label
                htmlFor="menu-global-file-input"
                onClick={onTriggerFileUpload}
                className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                title={t('menuScanner.uploadPhoto', 'Upload Photo')}
              >
                <Upload className="w-3.5 h-3.5" />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
