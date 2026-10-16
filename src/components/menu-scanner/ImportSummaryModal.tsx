import React from 'react';
import {
  CheckCircle2,
  Package,
  FolderTree,
  CreditCard,
  ArrowRight,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { ImportSummary } from '../../types/menuScanner.ts';
import { usePOS } from '../../context/POSContext.tsx';

interface ImportSummaryModalProps {
  isOpen: boolean;
  summary: ImportSummary | null;
  onGoToPOS: () => void;
  onGoToProducts: () => void;
  onScanAnother: () => void;
}

export const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({
  isOpen,
  summary,
  onGoToPOS,
  onGoToProducts,
  onScanAnother
}) => {
  const { t } = usePOS();
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Success Header */}
        <div className="p-8 text-center bg-gradient-to-b from-blue-50 to-white border-b border-slate-100">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('menuScanner.summaryTitle', 'Menu Successfully Imported!')}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {t('menuScanner.summarySubtitle', 'All categories, products, prices, and variants have been safely stored in your AuraPOS database.')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">
                  {summary.totalImportedProducts + summary.totalUpdatedProducts}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {summary.totalImportedProducts} {t('menuScanner.newBadge', 'New')}, {summary.totalUpdatedProducts} {t('menuScanner.updatedBadge', 'Updated')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">
                  {summary.totalImportedCategories + summary.totalUpdatedCategories}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {t('menuScanner.categoriesSynced', 'Categories Synced')}
                </span>
              </div>
            </div>
          </div>

          {/* Sample Created List Preview */}
          {summary.createdProductNames.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                {t('menuScanner.sampleItemsAdded', 'Recently Added Items Sample:')}
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {summary.createdProductNames.slice(0, 8).map((name, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium"
                  >
                    {name}
                  </span>
                ))}
                {summary.createdProductNames.length > 8 && (
                  <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold">
                    +{summary.createdProductNames.length - 8} {t('menuScanner.more', 'more')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onGoToPOS}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            {t('menuScanner.goToPOS', 'Go to Point of Sale')}
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onGoToProducts}
            className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-sm transition-all"
          >
            {t('menuScanner.viewProducts', 'View Products')}
          </button>

          <button
            type="button"
            onClick={onScanAnother}
            className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            {t('menuScanner.scanAnother', 'Scan Another')}
          </button>
        </div>
      </div>
    </div>
  );
};
