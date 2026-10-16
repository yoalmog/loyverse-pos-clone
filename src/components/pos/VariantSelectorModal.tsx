import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant } from '../../types/pos.ts';
import { usePOS } from '../../context/POSContext.tsx';
import {
  X,
  Check,
  ShoppingCart,
  Layers,
  Sparkles,
  AlertTriangle,
  PackageCheck,
  PackageX,
  SlidersHorizontal,
  LayoutGrid,
  PanelRight,
  Maximize2,
  Tag,
  FileText,
  Plus,
  Minus,
  CheckCircle2,
  Info
} from 'lucide-react';

interface VariantSelectorModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (variant: ProductVariant, quantity: number, notes?: string) => void;
  defaultLayout?: 'modal' | 'drawer';
}

export const VariantSelectorModal: React.FC<VariantSelectorModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
  defaultLayout = 'modal'
}) => {
  const { settings, t, translateProductName } = usePOS();

  // Display Mode: 'modal' (Center Dialog) or 'drawer' (Slide-over Right Drawer)
  const [layoutMode, setLayoutMode] = useState<'modal' | 'drawer'>(defaultLayout);
  // View Tab: 'options' (Interactive Attribute Selectors: Size, Color, etc.) vs 'table' (All Variants Matrix)
  const [activeTab, setActiveTab] = useState<'options' | 'table'>('options');

  const variants = useMemo(() => product.variants || [], [product.variants]);

  // Extract all attribute keys across variants (e.g., ['size', 'color', 'temp', 'grind', 'milk'])
  const attributeGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};

    variants.forEach(variant => {
      // If variant has explicit attributes
      if (variant.attributes && Object.keys(variant.attributes).length > 0) {
        Object.entries(variant.attributes).forEach(([key, val]) => {
          const cleanKey = key.trim().toLowerCase();
          const cleanVal = String(val).trim();
          if (!groups[cleanKey]) groups[cleanKey] = [];
          if (!groups[cleanKey].includes(cleanVal)) {
            groups[cleanKey].push(cleanVal);
          }
        });
      } else {
        // Fallback: parse from name e.g. "Small (12oz)" -> Size: Small (12oz)
        if (!groups['option']) groups['option'] = [];
        if (!groups['option'].includes(variant.name)) {
          groups['option'].push(variant.name);
        }
      }
    });

    return groups;
  }, [variants]);

  // Selected combination map: { size: '12oz', color: 'Blue', ... }
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  // Initialize selected combination with first available active variant
  useEffect(() => {
    if (variants.length > 0) {
      const initial = variants.find(v => v.active && (v.stock === undefined || v.stock > 0)) || variants[0];
      setSelectedVariantId(initial.id);
      setQuantity(1);
      setItemNotes('');

      if (initial.attributes && Object.keys(initial.attributes).length > 0) {
        const initialMap: Record<string, string> = {};
        Object.entries(initial.attributes).forEach(([k, v]) => {
          initialMap[k.toLowerCase()] = String(v);
        });
        setSelectedAttributes(initialMap);
      } else {
        setSelectedAttributes({ option: initial.name });
      }
    }
  }, [variants, product.id, isOpen]);

  // Resolve the exact matched variant from current selected combination
  const matchedVariant = useMemo<ProductVariant | null>(() => {
    if (variants.length === 0) return null;

    // If explicit ID selected directly from table
    const byId = variants.find(v => v.id === selectedVariantId);

    // Try to match by combination of attributes
    const byAttrs = variants.find(v => {
      if (!v.attributes || Object.keys(v.attributes).length === 0) {
        return selectedAttributes['option'] === v.name;
      }
      return Object.entries(selectedAttributes).every(([k, val]) => {
        const variantVal = v.attributes[k] || v.attributes[k.toLowerCase()] || v.attributes[capitalize(k)];
        return variantVal !== undefined && String(variantVal).toLowerCase() === String(val).toLowerCase();
      });
    });

    return byAttrs || byId || variants[0];
  }, [variants, selectedAttributes, selectedVariantId]);

  if (!isOpen || variants.length === 0) return null;

  const currentPrice = matchedVariant ? matchedVariant.price : product.price;
  const currentCost = matchedVariant ? matchedVariant.cost : product.cost;
  const effectiveStock = matchedVariant?.stock !== undefined ? matchedVariant.stock : product.stock;
  const isOutOfStock = product.trackInventory && effectiveStock <= 0;
  const isLowStock = product.trackInventory && effectiveStock > 0 && effectiveStock <= (product.lowStockThreshold || 5);
  const canAddToCart = !isOutOfStock || settings.allowNegativeStock;
  const lineTotal = currentPrice * quantity;

  // Handler for clicking an option chip in an attribute group
  const handleSelectAttributeValue = (attrKey: string, value: string) => {
    const updated = { ...selectedAttributes, [attrKey]: value };
    setSelectedAttributes(updated);

    // Find if a variant matches this new combination and update selected ID
    const found = variants.find(v => {
      if (!v.attributes || Object.keys(v.attributes).length === 0) {
        return updated['option'] === v.name;
      }
      return Object.entries(updated).every(([k, val]) => {
        const variantVal = v.attributes[k] || v.attributes[k.toLowerCase()] || v.attributes[capitalize(k)];
        return variantVal !== undefined && String(variantVal).toLowerCase() === String(val).toLowerCase();
      });
    });

    if (found) {
      setSelectedVariantId(found.id);
    }
  };

  const handleConfirmAddToCart = () => {
    if (!matchedVariant || !canAddToCart) return;
    onConfirm(matchedVariant, quantity, itemNotes);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex transition-all duration-300 ${
        layoutMode === 'drawer'
          ? 'justify-end items-stretch'
          : 'justify-center items-center p-3 sm:p-4'
      }`}
    >
      <div
        className={`bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${
          layoutMode === 'drawer'
            ? 'w-full max-w-lg h-full rounded-l-3xl rounded-r-none animate-slideLeft'
            : 'w-full max-w-xl max-h-[92vh] rounded-3xl animate-fadeIn'
        }`}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {product.imageUrl ? (
              <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-white shadow-xs">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs font-bold text-base"
                style={{
                  backgroundColor: product.color ? `${product.color}18` : '#EFF6FF',
                  color: product.color || '#2563EB'
                }}
              >
                <Layers className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {translateProductName(product.id, product.name)}
                </h3>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full shrink-0">
                  {variants.length} {t('pos.options', 'variants')}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {product.description || t('pos.selectVariantDesc', 'Choose size, color, or option combination')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* Toggle Drawer / Modal Mode */}
            <button
              type="button"
              onClick={() => setLayoutMode(m => (m === 'modal' ? 'drawer' : 'modal'))}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors hidden sm:flex items-center justify-center"
              title={layoutMode === 'modal' ? 'Switch to Side Drawer' : 'Switch to Center Modal'}
            >
              {layoutMode === 'modal' ? (
                <PanelRight className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Tabs: Option Selectors (Pills) vs All Combinations Table */}
        <div className="px-4 sm:px-6 pt-3 pb-1 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0 bg-white">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('options')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'options'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t('pos.optionPills', 'Option Groups')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'table'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t('pos.allCombinations', 'All Variants')} ({variants.length})</span>
            </button>
          </div>

          {matchedVariant && (
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              SKU: {matchedVariant.sku}
            </span>
          )}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: INTERACTIVE ATTRIBUTE GROUPS (Size: S, M, L; Color: Red, Blue; Temp: Hot, Iced) */}
          {activeTab === 'options' && (
            <div className="space-y-4">
              {Object.entries(attributeGroups).map(([attrKey, values]) => {
                const groupTitle = formatAttributeTitle(attrKey);
                const currentValue = selectedAttributes[attrKey] || values[0];

                return (
                  <div key={attrKey} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>{groupTitle}</span>
                      </label>
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        {currentValue}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {values.map(val => {
                        const isSelected = currentValue.toLowerCase() === val.toLowerCase();
                        const isColor = attrKey.toLowerCase().includes('color');
                        const hex = isColor ? getColorHex(val) : null;

                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleSelectAttributeValue(attrKey, val)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-800'
                            }`}
                          >
                            {/* Color Dot if color attribute */}
                            {hex && (
                              <span
                                className={`w-3.5 h-3.5 rounded-full border ${
                                  isSelected ? 'border-white' : 'border-slate-300'
                                }`}
                                style={{ backgroundColor: hex }}
                              />
                            )}

                            <span>{val}</span>

                            {isSelected && <Check className="w-3.5 h-3.5 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: ALL COMBINATIONS MATRIX LIST */}
          {activeTab === 'table' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                {t('pos.pickCombination', 'Direct Variant Selection')}
              </label>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {variants.map(variant => {
                  const isSelected = matchedVariant?.id === variant.id;
                  const vStock = variant.stock !== undefined ? variant.stock : product.stock;
                  const vOutOfStock = product.trackInventory && vStock <= 0;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        if (variant.attributes) {
                          const map: Record<string, string> = {};
                          Object.entries(variant.attributes).forEach(([k, v]) => {
                            map[k.toLowerCase()] = String(v);
                          });
                          setSelectedAttributes(map);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold ring-1 ring-blue-600 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{variant.name}</span>
                            {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {Object.values(variant.attributes).join(' · ')}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            {variant.sku}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold font-mono text-slate-900 block">
                          ${variant.price.toFixed(2)}
                        </span>
                        {product.trackInventory && (
                          <span
                            className={`text-[10px] font-mono block ${
                              vOutOfStock ? 'text-rose-600 font-bold' : 'text-slate-500'
                            }`}
                          >
                            {vOutOfStock ? 'Out of stock' : `${vStock} in stock`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ACTIVE COMBINATION SUMMARY CARD */}
          {matchedVariant && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {t('pos.activeVariant', 'Selected Combination')}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                    {matchedVariant.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    SKU: {matchedVariant.sku} {matchedVariant.barcode ? `· Barcode: ${matchedVariant.barcode}` : ''}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-blue-600 block">
                    ${matchedVariant.price.toFixed(2)}
                  </span>
                  {currentCost > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Cost: ${currentCost.toFixed(2)} ({Math.round(((currentPrice - currentCost) / currentPrice) * 100)}% margin)
                    </span>
                  )}
                </div>
              </div>

              {/* Stock Status Indicator */}
              <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Inventory Availability:</span>
                {product.trackInventory ? (
                  <div className="flex items-center gap-1.5">
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200 text-xs">
                        <PackageX className="w-3.5 h-3.5" />
                        <span>Out of Stock (0 units)</span>
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-md border border-amber-200 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Low Stock ({effectiveStock} units left)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-200 text-xs">
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>In Stock ({effectiveStock} units)</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Inventory not tracked</span>
                )}
              </div>
            </div>
          )}

          {/* QUANTITY STEPPER & PRESETS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {t('pos.quantity', 'Quantity')}
              </label>
              <span className="text-xs text-slate-400 font-mono">
                Line Total: <strong className="text-slate-900 text-sm font-bold font-mono">${lineTotal.toFixed(2)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Stepper */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-800 shadow-2xs font-bold flex items-center justify-center transition-all cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min="1"
                  max={product.trackInventory && !settings.allowNegativeStock ? effectiveStock : 999}
                  value={quantity}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) setQuantity(val);
                  }}
                  className="w-12 text-center text-base font-bold font-mono text-slate-900 bg-transparent focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-800 shadow-2xs font-bold flex items-center justify-center transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick number presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {[1, 2, 3, 5, 10].map(qtyNum => (
                  <button
                    key={qtyNum}
                    type="button"
                    onClick={() => setQuantity(qtyNum)}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      quantity === qtyNum
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {qtyNum}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ITEM NOTES / CUSTOM INSTRUCTIONS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('pos.itemNotes', 'Kitchen & Item Notes')}</span>
            </label>
            <input
              type="text"
              value={itemNotes}
              onChange={e => setItemNotes(e.target.value)}
              placeholder="e.g. Extra hot, oat milk, no sugar, gift receipt..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {t('auth.cancel', 'Cancel')}
          </button>

          <button
            type="button"
            disabled={!canAddToCart || !matchedVariant}
            onClick={handleConfirmAddToCart}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold rounded-2xl shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>
              {isOutOfStock && !settings.allowNegativeStock
                ? t('pos.outOfStock', 'Out of Stock')
                : `${t('pos.addToTicket', 'Add to Ticket')} · $${lineTotal.toFixed(2)}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper to format attribute keys (e.g. "size" -> "Size", "temp" -> "Temperature")
function formatAttributeTitle(key: string): string {
  const map: Record<string, string> = {
    size: 'Size / Volume',
    color: 'Color Variant',
    temp: 'Temperature',
    milk: 'Milk Option',
    grind: 'Grind Type',
    style: 'Style / Preparation',
    flavor: 'Flavor Profile',
    option: 'Option'
  };
  return map[key.toLowerCase()] || capitalize(key);
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Helper to assign CSS colors for color attribute swatches
function getColorHex(colorName: string): string | null {
  const map: Record<string, string> = {
    slate: '#475569',
    clay: '#B45309',
    cobalt: '#1D4ED8',
    blue: '#2563EB',
    red: '#E11D48',
    ruby: '#BE123C',
    black: '#0F172A',
    onyx: '#18181B',
    white: '#FFFFFF',
    sage: '#84CC16',
    green: '#15803D',
    terracotta: '#C2410C',
    pink: '#EC4899',
    gold: '#EAB308',
    amber: '#D97706'
  };
  const key = colorName.toLowerCase();
  for (const [k, hex] of Object.entries(map)) {
    if (key.includes(k)) return hex;
  }
  return null;
}
