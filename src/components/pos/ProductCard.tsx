import React, { useState } from 'react';
import { Product } from '../../types/pos.ts';
import { usePOS } from '../../context/POSContext.tsx';
import {
  Coffee,
  Leaf,
  Croissant,
  Utensils,
  GlassWater,
  Cake,
  ShoppingBag,
  Layers,
  Package,
  Flame,
  Pizza,
  Wine,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Coffee,
  Leaf,
  Croissant,
  Utensils,
  GlassWater,
  Cake,
  ShoppingBag,
  Package,
  Flame,
  Pizza,
  Wine,
  Sparkles
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { settings, t, translateProductName, formatCurrency } = usePOS();
  const [imageError, setImageError] = useState<boolean>(false);

  const IconComponent =
    product.iconName && ICON_MAP[product.iconName]
      ? ICON_MAP[product.iconName]
      : Utensils;

  const isOutOfStock = product.trackInventory && product.stock <= 0;
  const isLowStock =
    product.trackInventory &&
    product.stock > 0 &&
    product.stock <= product.lowStockThreshold;
  const hasVariants = product.variants && product.variants.length > 0;
  const hasValidImage = !!product.imageUrl && !imageError;
  const localizedName = translateProductName(product.id, product.name);
  const formattedPrice = formatCurrency(product.price);

  // Rich ARIA content description for TalkBack / Screen Readers (Section 6 & 18)
  const accessibleLabel = `${localizedName}, price ${formattedPrice}${
    hasVariants ? `, ${product.variants!.length} sizes available` : ''
  }${
    product.trackInventory
      ? isOutOfStock
        ? ', Out of stock'
        : isLowStock
        ? `, Low stock, only ${product.stock} left`
        : `, ${product.stock} in stock`
      : ''
  }. Press to add to current order.`;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      disabled={isOutOfStock && !settings.allowNegativeStock}
      aria-label={accessibleLabel}
      aria-disabled={isOutOfStock && !settings.allowNegativeStock}
      className={`group relative flex flex-col justify-between text-left rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs cursor-pointer theme-card ${
        isOutOfStock && !settings.allowNegativeStock
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:shadow-md hover:border-[var(--theme-primary)] active:scale-[0.98]'
      }`}
    >
      {/* 1. Large Top Hero Image / Visual Banner */}
      <div className="relative w-full h-26 sm:h-28 bg-slate-100 overflow-hidden shrink-0">
        {hasValidImage ? (
          <img
            src={product.imageUrl}
            alt={`${localizedName} product photo`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-3 transition-transform duration-300 group-hover:scale-105"
            style={{
              backgroundColor: product.color ? `${product.color}18` : 'var(--theme-surface-variant)',
              background: product.color
                ? `linear-gradient(135deg, ${product.color}25 0%, ${product.color}08 100%)`
                : 'linear-gradient(135deg, var(--theme-surface-variant) 0%, var(--theme-bg) 100%)'
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs border border-white/60 mb-1"
              style={{
                backgroundColor: product.color || 'var(--theme-primary)',
                color: '#FFFFFF'
              }}
              aria-hidden="true"
            >
              <IconComponent className="w-7 h-7" />
            </div>
          </div>
        )}

        {/* Subtle Dark Gradient Overlay for Badge Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/25 pointer-events-none" aria-hidden="true" />

        {/* Top Badges Overlay */}
        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 pointer-events-none">
          {/* Favorite Star */}
          {product.isFavorite ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
              ★ Fav
            </span>
          ) : (
            <div />
          )}

          {/* Stock or Options Badge (With Color-Blind Accessible Symbols) */}
          {hasVariants ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-slate-900/85 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-xs border border-white/10">
              <Layers className="w-3 h-3 text-blue-300" aria-hidden="true" />
              <span>{product.variants!.length} {t('pos.options', 'options')}</span>
            </span>
          ) : product.trackInventory ? (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs leading-tight inline-flex items-center gap-1 ${
                isOutOfStock
                  ? 'bg-rose-700 text-white'
                  : isLowStock
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900/80 text-white border border-white/10'
              }`}
            >
              {isOutOfStock ? (
                <>
                  <XCircle className="w-3 h-3 text-white" aria-hidden="true" />
                  <span>✕ {t('pos.outOfStock', 'Out of stock')}</span>
                </>
              ) : isLowStock ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-white" aria-hidden="true" />
                  <span>⚠ {product.stock} {t('pos.inStock', 'left')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  <span>✓ {product.stock} {t('pos.inStock', 'in stock')}</span>
                </>
              )}
            </span>
          ) : null}
        </div>
      </div>

      {/* 2. Bottom Content: Name & Price */}
      <div className="p-3 w-full flex-1 flex flex-col justify-between">
        <h4 className="text-xs font-bold transition-colors line-clamp-2 leading-snug group-hover:text-[var(--theme-primary)]" style={{ color: 'var(--theme-text-primary)' }}>
          {localizedName}
        </h4>

        <div className="mt-2 pt-2 border-t flex items-baseline justify-between gap-1" style={{ borderColor: 'var(--theme-divider)' }}>
          <p className="text-base font-extrabold font-mono tabular-nums" style={{ color: 'var(--theme-text-primary)' }}>
            {formattedPrice}
          </p>
          <span className="text-[10px] font-mono truncate max-w-[70px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {product.sku}
          </span>
        </div>
      </div>

      {/* Low stock warning marker */}
      {isLowStock && (
        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white z-10" aria-hidden="true" />
      )}
    </button>
  );
};
