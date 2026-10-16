import React, { useMemo } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import {
  LayoutGrid,
  Star,
  Coffee,
  Leaf,
  Croissant,
  Utensils,
  GlassWater,
  Cake,
  ShoppingBag,
  Package,
  Pizza,
  Salad,
  IceCream,
  Beer,
  Wine,
  Apple,
  Sparkles,
  Tag,
  Layers,
  Flame,
  CupSoda
} from 'lucide-react';

interface CategoryPanelProps {
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

export const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  LayoutGrid,
  Star,
  Coffee,
  Leaf,
  Croissant,
  Utensils,
  GlassWater,
  Cake,
  ShoppingBag,
  Package,
  Pizza,
  Salad,
  IceCream,
  Beer,
  Wine,
  Apple,
  Sparkles,
  Tag,
  Layers,
  Flame,
  CupSoda
};

export const CategoryPanel: React.FC<CategoryPanelProps> = ({
  selectedCategoryId,
  onSelectCategory,
}) => {
  const { categories, products, t, translateCategoryName } = usePOS();

  // Load only active categories ordered by sort_order (Requirement 10 & 14)
  const activeCategories = useMemo(() => {
    return categories
      .filter(c => c.active)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [categories]);

  const hasFavorites = useMemo(() => {
    return products.some(p => p.active && p.isFavorite);
  }, [products]);

  const getProductCount = (catId: string) => {
    if (catId === 'cat_all') return products.filter(p => p.active).length;
    if (catId === 'cat_fav') return products.filter(p => p.active && p.isFavorite).length;
    return products.filter(p => p.active && p.categoryId === catId).length;
  };

  return (
    <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 theme-surface border-b border-[var(--theme-border)] overflow-x-auto shrink-0 select-none scrollbar-none">
      {/* 1. All Items Category Button */}
      <button
        onClick={() => onSelectCategory('cat_all')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
          selectedCategoryId === 'cat_all'
            ? 'bg-[var(--theme-primary)] text-[var(--theme-button-text)] font-semibold shadow-xs'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>{t('pos.allCategories', 'All Items')}</span>
        <span
          className={`text-[10px] font-mono px-1 py-0.2 rounded ${
            selectedCategoryId === 'cat_all' ? 'bg-black/20 text-white' : 'bg-slate-200/80 text-slate-500'
          }`}
        >
          {getProductCount('cat_all')}
        </span>
      </button>

      {/* 2. Optional Favorites Button */}
      {hasFavorites && (
        <button
          onClick={() => onSelectCategory('cat_fav')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
            selectedCategoryId === 'cat_fav'
              ? 'bg-amber-500 text-white font-semibold shadow-xs'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>{t('pos.favorites', 'Favorites')}</span>
          <span
            className={`text-[10px] font-mono px-1 py-0.2 rounded ${
              selectedCategoryId === 'cat_fav' ? 'bg-amber-600 text-amber-100' : 'bg-amber-200/80 text-amber-800'
            }`}
          >
            {getProductCount('cat_fav')}
          </span>
        </button>
      )}

      {/* 3. Database Active Categories */}
      {activeCategories.map(cat => {
        const Icon = CATEGORY_ICON_MAP[cat.iconName] || CATEGORY_ICON_MAP.Package;
        const isSelected = selectedCategoryId === cat.id;
        const count = getProductCount(cat.id);
        const displayName = translateCategoryName(cat.id, cat.name);

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
              isSelected
                ? 'bg-[var(--theme-primary)] text-[var(--theme-button-text)] font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat.imageUrl ? (
              <img src={cat.imageUrl} alt={displayName} className="w-3.5 h-3.5 rounded object-cover" />
            ) : (
              <Icon className="w-3.5 h-3.5" style={!isSelected && cat.color ? { color: cat.color } : {}} />
            )}
            <span>{displayName}</span>
            <span
              className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                isSelected ? 'bg-black/20 text-white' : 'bg-slate-200/80 text-slate-500'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
