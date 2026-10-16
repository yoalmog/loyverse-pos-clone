import React, { useState, useMemo } from 'react';
import {
  Check,
  Edit2,
  Trash2,
  Plus,
  Search,
  Filter,
  Layers,
  Sparkles,
  AlertTriangle,
  FolderTree,
  DollarSign,
  Utensils,
  ChevronRight,
  ChevronDown,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  Tag,
  CheckCircle2,
  Coffee,
  Flame,
  HelpCircle,
  Copy,
  RotateCcw,
  RotateCw,
  Undo2,
  Image as ImageIcon
} from 'lucide-react';
import {
  ExtractedCategory,
  ExtractedProduct,
  ExtractedVariant,
  ExtractedModifierGroup,
  ScannedMenuPage,
  ConflictResolution
} from '../../types/menuScanner.ts';
import { Category, Product } from '../../types/pos.ts';
import { CATEGORY_ICON_MAP } from '../pos/CategoryPanel.tsx';
import { ProductAiImageStudio } from './ProductAiImageStudio.tsx';
import { BatchAiImageModal } from './BatchAiImageModal.tsx';
import { ConfidenceCropBadge } from './ConfidenceCropBadge.tsx';
import { usePOS } from '../../context/POSContext.tsx';

interface ReviewStepProps {
  categories: ExtractedCategory[];
  products: ExtractedProduct[];
  pages: ScannedMenuPage[];
  existingCategories: Category[];
  existingProducts: Product[];
  onUpdateCategory: (updated: ExtractedCategory) => void;
  onAddCategory: (newCategory: ExtractedCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
  onUpdateProduct: (updated: ExtractedProduct) => void;
  onAddProduct: (newProduct: ExtractedProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onBulkSelectProducts: (selected: boolean, categoryName?: string) => void;
  onBulkSetResolution: (resolution: ConflictResolution) => void;
  onCommitImport: () => void;
  isImporting: boolean;
  currencySymbol: string;
  onEnhanceWithAi?: () => Promise<void>;
  isAiEnhancing?: boolean;
  aiEnhanceNotice?: string | null;
  onRerunOcr?: () => Promise<void>;
  onUpdateProductsBatch?: (updatedProducts: ExtractedProduct[]) => void;
  onRotatePageRight?: (id: string) => void;
  onRotatePageLeft?: (id: string) => void;
  onResetPageOrientation?: (id: string) => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  categories,
  products,
  pages,
  existingCategories,
  existingProducts,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
  onUpdateProduct,
  onAddProduct,
  onDeleteProduct,
  onBulkSelectProducts,
  onBulkSetResolution,
  onCommitImport,
  isImporting,
  currencySymbol,
  onEnhanceWithAi,
  isAiEnhancing,
  aiEnhanceNotice,
  onRerunOcr,
  onUpdateProductsBatch,
  onRotatePageRight,
  onRotatePageLeft,
  onResetPageOrientation
}) => {
  const { t } = usePOS();
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showImagePanel, setShowImagePanel] = useState<boolean>(true);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Requirement 3: Show "Original" and "Corrected for scanning"
  const [imageDisplayMode, setImageDisplayMode] = useState<'corrected' | 'original'>('corrected');

  // AI Product Image Studio Modal & Batch Modal (Requirements 8, 10, 11)
  const [aiStudioProduct, setAiStudioProduct] = useState<ExtractedProduct | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  // Editing state for modals/drawers
  const [editingProduct, setEditingProduct] = useState<ExtractedProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExtractedCategory | null>(null);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState<boolean>(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState<boolean>(false);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategoryFilter !== 'all' && p.categoryName.toLowerCase() !== selectedCategoryFilter.toLowerCase()) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.categoryName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategoryFilter, searchTerm]);

  // Metrics
  const selectedProductsCount = useMemo(() => products.filter(p => p.selected && p.resolution !== 'skip').length, [products]);
  const selectedCategoriesCount = useMemo(() => categories.filter(c => c.selected && c.resolution !== 'skip').length, [categories]);
  const conflictedProductsCount = useMemo(() => products.filter(p => p.conflictType !== 'none').length, [products]);
  const aiImagesCount = useMemo(() => products.filter(p => p.imageUrl && p.imageSource === 'AI_GENERATED').length, [products]);

  // Current page for image inspection
  const currentPage = pages[selectedPageIdx] || pages[0];

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Top Banner with Stats & Actions */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              {t('menuScanner.reviewTitle', 'Review Extracted Catalog')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('menuScanner.reviewDesc', 'Verify extracted categories, item names, prices, and variants before saving.')}
            </p>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block" />

          {/* Quick Metrics Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
              {t('menuScanner.productsTab', `Products (${selectedProductsCount})`, { count: selectedProductsCount })}
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              {aiImagesCount} AI Photos
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
              {t('menuScanner.categoriesTab', `Categories (${selectedCategoriesCount})`, { count: selectedCategoriesCount })}
            </div>
            {conflictedProductsCount > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                {conflictedProductsCount} Existing Matches
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Requirement 11: Batch AI Image Generation Button */}
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="Batch AI Image Generation"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            {t('menuScanner.enhanceAi', 'AI Menu Enricher')}
          </button>

          {/* Toggle Scanned Image Viewer Button */}
          {pages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowImagePanel(prev => !prev)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showImagePanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              {showImagePanel ? t('common.hideImage', 'Hide Menu Image') : t('common.viewImage', 'View Menu Image')}
            </button>
          )}

          {/* Final Commit Import Button */}
          <button
            type="button"
            onClick={onCommitImport}
            disabled={selectedProductsCount === 0 || isImporting}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isImporting ? t('menuScanner.importing', 'Importing...') : t('menuScanner.commitImport', 'Confirm & Import to Catalog')}
          </button>
        </div>
      </div>

      {/* Main Content Workspace (Split Layout) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Original / Corrected Scanned Image Viewer (Collapsible) */}
        {showImagePanel && pages.length > 0 && (
          <div className="w-80 md:w-96 lg:w-[460px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-white select-none">
            {/* Image Viewer Header & Controls */}
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300">
                  {t('menuScanner.pageLabel', `Page ${selectedPageIdx + 1}`, { number: selectedPageIdx + 1 })}/{pages.length}
                </span>

                {/* Requirement 3: Show "Original" and "Corrected for scanning" */}
                <div className="inline-flex rounded-lg bg-slate-800 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setImageDisplayMode('corrected')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                      imageDisplayMode === 'corrected'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('menuScanner.correctedImage', 'Corrected')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageDisplayMode('original')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                      imageDisplayMode === 'original'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('menuScanner.originalImage', 'Original')}
                  </button>
                </div>
              </div>

              {/* Rotation & Zoom Controls (Requirement 3: Rotate Left, Rotate Right, Reset) */}
              <div className="flex items-center gap-1.5">
                {onRotatePageLeft && currentPage && (
                  <button
                    type="button"
                    onClick={() => onRotatePageLeft(currentPage.id)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title={t('menuScanner.rotateLeft', 'Rotate Left')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                {onRotatePageRight && currentPage && (
                  <button
                    type="button"
                    onClick={() => onRotatePageRight(currentPage.id)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title={t('menuScanner.rotateRight', 'Rotate Right')}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}
                {onResetPageOrientation && currentPage && (
                  <button
                    type="button"
                    onClick={() => onResetPageOrientation(currentPage.id)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title={t('menuScanner.resetOrientation', 'Reset Orientation')}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.max(0.75, z - 0.25))}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  -
                </button>
                <span className="text-[10px] text-slate-400 font-mono">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.25))}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  +
                </button>
              </div>
            </div>

            {/* Traceability Indicator Bar */}
            <div className="px-4 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                Toque cualquier plato para resaltar en la foto
              </span>
              {selectedProductId && (
                <button
                  type="button"
                  onClick={() => setSelectedProductId(null)}
                  className="text-blue-400 hover:underline text-[10px]"
                >
                  Limpiar Selección
                </button>
              )}
            </div>

            {/* Main Image Display */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
              <div
                style={{ transform: `scale(${zoomLevel})` }}
                className="transition-transform duration-150 origin-center max-w-full relative inline-block"
              >
                <img
                  src={
                    imageDisplayMode === 'original'
                      ? currentPage?.originalDataUrl || currentPage?.dataUrl
                      : currentPage?.correctedDataUrl || currentPage?.dataUrl
                  }
                  alt={`${t('menuScanner.pageLabel', 'Menu Page')} ${selectedPageIdx + 1}`}
                  className="rounded-lg shadow-2xl border border-slate-700 max-h-[72vh] object-contain block select-none pointer-events-none"
                />

                {/* Interactive SVG Bounding Box Layer */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {products
                    .filter(p => (p.sourcePage || (p.pageIndex! + 1)) === selectedPageIdx + 1 && p.sourceBoundingBox)
                    .map(p => {
                      const b = p.sourceBoundingBox!;
                      const isTarget = selectedProductId === (p.id || p.tempId);
                      return (
                        <rect
                          key={`bbox-${p.id || p.tempId}`}
                          x={b.left * 100}
                          y={b.top * 100}
                          width={b.width * 100}
                          height={b.height * 100}
                          fill={isTarget ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
                          stroke={isTarget ? '#3B82F6' : 'rgba(255, 255, 255, 0.4)'}
                          strokeWidth={isTarget ? '1.5' : '0.75'}
                          rx="1"
                        />
                      );
                    })}
                </svg>
              </div>
            </div>

            {/* Multi-page thumbnails selector */}
            {pages.length > 1 && (
              <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                {pages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPageIdx(idx)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition-colors ${
                      selectedPageIdx === idx
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('menuScanner.pageLabel', `Page ${idx + 1}`, { number: idx + 1 })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Side: Tabular Review of Products & Categories */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {/* Subheader: Tabs & Search / Filter */}
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'products'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t('menuScanner.productsTab', `Products (${products.length})`, { count: products.length })}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'categories'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t('menuScanner.categoriesTab', `Categories (${categories.length})`, { count: categories.length })}
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'products' && (
                <>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t('menuScanner.searchItems', 'Search extracted items...')}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none w-48 sm:w-60"
                    />
                  </div>

                  <select
                    value={selectedCategoryFilter}
                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                    className="py-1.5 px-3 text-xs bg-slate-100 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="all">{t('menuScanner.allCategories', 'All Categories')}</option>
                    {categories.map(c => (
                      <option key={c.id || c.tempId} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsAddProductModalOpen(true)}
                    className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 flex items-center gap-1 cursor-pointer"
                    title={t('menuScanner.addItem', 'Add Item')}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('menuScanner.addItem', 'Add Item')}</span>
                  </button>
                </>
              )}

              {activeTab === 'categories' && (
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('menuScanner.addCategory', 'Add Category')}
                </button>
              )}
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {activeTab === 'products' && (
            <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onBulkSelectProducts(true)}
                  className="hover:text-blue-600 font-medium cursor-pointer"
                >
                  {t('common.selectAll', 'Select All')}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => onBulkSelectProducts(false)}
                  className="hover:text-blue-600 font-medium cursor-pointer"
                >
                  {t('common.deselectAll', 'Deselect All')}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">{t('menuScanner.conflictAction', 'Import Action')}:</span>
                <button
                  type="button"
                  onClick={() => onBulkSetResolution('update_existing')}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 border border-slate-300 font-medium text-slate-700 cursor-pointer"
                >
                  {t('menuScanner.conflictUpdate', 'Update Existing')}
                </button>
                <button
                  type="button"
                  onClick={() => onBulkSetResolution('create_new')}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 border border-slate-300 font-medium text-slate-700 cursor-pointer"
                >
                  {t('menuScanner.conflictCreateNew', 'Create New')}
                </button>
              </div>
            </div>
          )}

          {/* Tab 1: Products Table & Cards View */}
          {activeTab === 'products' && (
            <div className="flex-1 overflow-y-auto p-6">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-semibold text-slate-800">No hay platos que coincidan con el filtro</h4>
                  <p className="text-xs text-slate-500 mt-1">Intente restablecer la búsqueda o categoría</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProducts.map(product => {
                    const hasVariants = product.variants && product.variants.length > 0;
                    const hasModifiers = product.modifiers && product.modifiers.length > 0;
                    const isSelected = selectedProductId === product.id || selectedProductId === product.tempId;

                    return (
                      <div
                        id={`prod-card-${product.id || product.tempId}`}
                        key={product.id || product.tempId}
                        onClick={() => {
                          setSelectedProductId(product.id || product.tempId);
                          if (product.sourcePage && product.sourcePage <= pages.length) {
                            setSelectedPageIdx(product.sourcePage - 1);
                          } else if (product.pageIndex !== undefined && product.pageIndex < pages.length) {
                            setSelectedPageIdx(product.pageIndex);
                          }
                        }}
                        className={`rounded-xl border transition-all p-4 shadow-xs cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/25'
                            : !product.selected
                            ? 'opacity-60 border-slate-200 bg-slate-50/50'
                            : product.conflictType !== 'none' || product.duplicateMatch === 'POSSIBLE DUPLICATE'
                            ? 'bg-white border-amber-200 hover:border-amber-300'
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          {/* Left Checkbox & Product Details */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={product.selected}
                              onChange={e => {
                                e.stopPropagation();
                                onUpdateProduct({ ...product, selected: e.target.checked });
                              }}
                              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-1 shrink-0 cursor-pointer"
                            />

                            {/* Product Thumbnail / AI Studio Trigger (Requirements 7, 8, 10) */}
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                setAiStudioProduct(product);
                              }}
                              className="relative group/thumb cursor-pointer shrink-0"
                              title="Haga clic para generar o gestionar imagen con IA"
                            >
                              {product.imageUrl ? (
                                <div className="relative">
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-2xs group-hover/thumb:ring-2 group-hover/thumb:ring-purple-400 transition-all"
                                  />
                                  <span
                                    className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-0.2 rounded-full border shadow-2xs ${
                                      product.imageSource === 'AI_GENERATED'
                                        ? 'bg-purple-600 text-white border-purple-400'
                                        : 'bg-blue-600 text-white border-blue-400'
                                    }`}
                                  >
                                    {product.imageSource === 'AI_GENERATED' ? 'IA' : 'Real'}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-purple-600 transition-all shadow-2xs">
                                  <Sparkles className="w-4 h-4 mb-0.5 text-purple-500" />
                                  <span className="text-[8px] font-bold text-slate-500">+ Foto</span>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Preserved Spanish Product Name with accents intact (Requirement 1) */}
                                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                  {product.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                                  {product.categoryName}
                                </span>

                                {/* Duplicate Match Badge */}
                                {product.duplicateMatch && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      product.duplicateMatch === 'MATCH'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : product.duplicateMatch === 'POSSIBLE DUPLICATE'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    {product.duplicateMatch === 'MATCH' ? 'COINCIDENCIA' : product.duplicateMatch}
                                  </span>
                                )}

                                {/* Visually Distinguish OCR Confidence Levels with Hover/Click Crop Inspection */}
                                <ConfidenceCropBadge
                                  confidence={product.confidence}
                                  isLowConfidence={product.isLowConfidence}
                                  confidenceLevel={product.confidenceLevel}
                                  fieldName={product.name}
                                  fieldValue={`${product.name} - ${currencySymbol}${product.price.toFixed(2)}`}
                                  boundingBox={product.sourceBoundingBox}
                                  sourcePage={product.sourcePage || (product.pageIndex !== undefined ? product.pageIndex + 1 : 1)}
                                  pages={pages}
                                />

                                {/* Dietary Badges */}
                                {product.isSpicy && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                    🌶️ Picante
                                  </span>
                                )}
                                {product.isVegetarian && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                    🌱 Vegetariano
                                  </span>
                                )}
                                {product.isGlutenFree && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                    🌾 Sin Gluten
                                  </span>
                                )}
                              </div>

                              {product.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                  {product.description}
                                </p>
                              )}

                              {/* Source Page & Traceability Tag */}
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                                {(product.sourcePage || product.pageIndex !== undefined) && (
                                  <span className="flex items-center gap-1 font-medium text-slate-600">
                                    <Eye className="w-3 h-3 text-blue-500" />
                                    {t('menuScanner.pageLabel', 'Page')} {product.sourcePage || (product.pageIndex! + 1)}
                                  </span>
                                )}

                                {product.warnings && product.warnings.length > 0 && (
                                  <span className="text-amber-700 font-medium">
                                    ⚠️ {product.warnings[0]}
                                  </span>
                                )}
                              </div>

                              {/* Variants & Modifiers indicators */}
                              {(hasVariants || hasModifiers) && (
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600">
                                  {hasVariants && (
                                    <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                      {product.variants.length} Tamaños (
                                      {product.variants.map(v => `${v.name}: ${currencySymbol}${v.price}`).join(', ')}
                                      )
                                    </span>
                                  )}
                                  {hasModifiers && (
                                    <span className="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                      {product.modifiers.length} Modificadores
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Price, Conflict Resolution & Actions */}
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            {/* Price Badge with OCR Verification */}
                            <div className="text-right flex flex-col items-end">
                              <span className="text-base font-extrabold text-slate-900 font-mono">
                                {currencySymbol}{product.price.toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <ConfidenceCropBadge
                                  confidence={product.confidence}
                                  isLowConfidence={product.isLowConfidence}
                                  confidenceLevel={product.confidenceLevel}
                                  fieldName={`Precio (${product.name})`}
                                  fieldValue={`${currencySymbol}${product.price.toFixed(2)}`}
                                  boundingBox={product.sourceBoundingBox}
                                  sourcePage={product.sourcePage || (product.pageIndex !== undefined ? product.pageIndex + 1 : 1)}
                                  pages={pages}
                                />
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                SKU: {product.sku}
                              </div>
                            </div>

                            {/* Conflict Resolution Selector */}
                            {product.conflictType !== 'none' && (
                              <div className="flex flex-col items-end" onClick={e => e.stopPropagation()}>
                                <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mb-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Coincidencia
                                </span>
                                <select
                                  value={product.resolution}
                                  onChange={e =>
                                    onUpdateProduct({
                                      ...product,
                                      resolution: e.target.value as ConflictResolution
                                    })
                                  }
                                  className="text-xs py-1 px-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-medium focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="update_existing">Actualizar Existente</option>
                                  <option value="create_new">Crear Nueva Copia</option>
                                  <option value="skip">Omitir / No Importar</option>
                                </select>
                              </div>
                            )}

                            {/* Actions Toolbar */}
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              {/* Open AI Image Studio Button */}
                              <button
                                type="button"
                                onClick={() => setAiStudioProduct(product)}
                                className="p-2 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors cursor-pointer"
                                title="Generar / Gestionar Imagen con IA"
                              >
                                <Sparkles className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingProduct(product)}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                                title="Editar Plato"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(product.id || product.tempId)}
                                className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Eliminar Plato"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Categories Management View */}
          {activeTab === 'categories' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => {
                  const IconComp = CATEGORY_ICON_MAP[category.iconName] || Utensils;
                  const isMerged = category.resolution === 'merge_existing';

                  return (
                    <div
                      key={category.id || category.tempId}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            style={{ backgroundColor: category.color }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                          >
                            <IconComp className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{category.name}</h4>
                            <span className="text-xs text-slate-500">
                              {category.productCount} {category.productCount === 1 ? 'plato' : 'platos'}
                            </span>
                          </div>
                        </div>

                        {isMerged && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Fusionar Existente
                          </span>
                        )}
                      </div>

                      {category.description && (
                        <p className="text-xs text-slate-600 mt-2 italic">{category.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
                        <span className="text-[11px] text-slate-400">
                          {category.autoPrintKitchen ? '🍳 Impresión cocina activa' : '🧾 Solo recibo'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingCategory(category)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600"
                            title="Editar Categoría"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCategory(category.id || category.tempId)}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                            title="Eliminar Categoría"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product AI Image Studio Modal (Requirement 8, 9, 10, 12, 13, 14) */}
      {aiStudioProduct && (
        <ProductAiImageStudio
          product={aiStudioProduct}
          currencySymbol={currencySymbol}
          onUpdateProduct={updated => {
            onUpdateProduct(updated);
            setAiStudioProduct(null);
          }}
          onClose={() => setAiStudioProduct(null)}
        />
      )}

      {/* Batch AI Image Generation Modal (Requirement 11) */}
      {isBatchModalOpen && (
        <BatchAiImageModal
          products={products}
          onUpdateProductsBatch={updatedList => {
            if (onUpdateProductsBatch) {
              onUpdateProductsBatch(updatedList);
            } else {
              updatedList.forEach(p => onUpdateProduct(p));
            }
            setIsBatchModalOpen(false);
          }}
          onClose={() => setIsBatchModalOpen(false)}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Editar Plato Escaneado</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Nombre del Plato *</label>
                  <ConfidenceCropBadge
                    confidence={editingProduct.confidence}
                    isLowConfidence={editingProduct.isLowConfidence}
                    confidenceLevel={editingProduct.confidenceLevel}
                    fieldName="Nombre"
                    fieldValue={editingProduct.name}
                    boundingBox={editingProduct.sourceBoundingBox}
                    sourcePage={editingProduct.sourcePage || (editingProduct.pageIndex !== undefined ? editingProduct.pageIndex + 1 : 1)}
                    pages={pages}
                  />
                </div>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={e =>
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                      originalText: e.target.value,
                      normalizedText: e.target.value.toLowerCase().trim()
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Product Image Section in Edit Modal */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Fotografía del Plato</span>
                  {editingProduct.imageSource === 'AI_GENERATED' && (
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-600" /> Generada con IA
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {editingProduct.imageUrl ? (
                    <img
                      src={editingProduct.imageUrl}
                      alt={editingProduct.name}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAiStudioProduct(editingProduct)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                      {editingProduct.imageUrl ? 'Gestionar Foto IA' : 'Generar Foto con IA'}
                    </button>
                    {editingProduct.imageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingProduct({
                            ...editingProduct,
                            imageUrl: '',
                            imageSource: 'NO_IMAGE',
                            aiImageState: 'idle'
                          })
                        }
                        className="px-3 py-1.5 rounded-xl hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-semibold border border-slate-200 transition-colors"
                      >
                        Quitar Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={editingProduct.categoryName}
                    onChange={e => {
                      const cat = categories.find(c => c.name === e.target.value);
                      setEditingProduct({
                        ...editingProduct,
                        categoryName: e.target.value,
                        categoryId: cat?.id
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id || c.tempId} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Precio ({currencySymbol})</label>
                    <ConfidenceCropBadge
                      confidence={editingProduct.confidence}
                      isLowConfidence={editingProduct.isLowConfidence}
                      confidenceLevel={editingProduct.confidenceLevel}
                      fieldName="Precio"
                      fieldValue={`${currencySymbol}${editingProduct.price.toFixed(2)}`}
                      boundingBox={editingProduct.sourceBoundingBox}
                      sourcePage={editingProduct.sourcePage || (editingProduct.pageIndex !== undefined ? editingProduct.pageIndex + 1 : 1)}
                      pages={pages}
                    />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción / Ingredientes</label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Costo Estimado</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.cost}
                    onChange={e => setEditingProduct({ ...editingProduct, cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Código de Barras</label>
                  <input
                    type="text"
                    value={editingProduct.barcode}
                    onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Dietary Flags */}
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingProduct.isSpicy}
                    onChange={e => setEditingProduct({ ...editingProduct, isSpicy: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  🌶️ Picante
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingProduct.isVegetarian}
                    onChange={e => setEditingProduct({ ...editingProduct, isVegetarian: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  🌱 Vegetariano
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingProduct.isGlutenFree}
                    onChange={e => setEditingProduct({ ...editingProduct, isGlutenFree: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  🌾 Sin Gluten
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateProduct(editingProduct);
                  setEditingProduct(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Editar Categoría</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Categoría</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCategory.autoPrintKitchen}
                    onChange={e => setEditingCategory({ ...editingCategory, autoPrintKitchen: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Auto-imprimir en Cocina
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateCategory(editingCategory);
                  setEditingCategory(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
              >
                Guardar Categoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Category Modal */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Nueva Categoría</h3>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const form = e.target as any;
                const name = form.catName.value.trim();
                if (!name) return;

                const newCat: ExtractedCategory = {
                  id: `cat_new_${Date.now()}`,
                  tempId: `temp_cat_${Date.now()}`,
                  name,
                  description: form.catDesc.value.trim(),
                  color: '#2563EB',
                  iconName: 'Package',
                  sortOrder: categories.length + 1,
                  active: true,
                  autoPrintKitchen: true,
                  productCount: 0,
                  selected: true,
                  resolution: 'create_new'
                };
                onAddCategory(newCat);
                setIsAddCategoryModalOpen(false);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Categoría *</label>
                <input
                  name="catName"
                  required
                  placeholder="ej. Especialidades Peruanas"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <input
                  name="catDesc"
                  placeholder="Subtítulo opcional..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="px-0 py-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  Agregar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
