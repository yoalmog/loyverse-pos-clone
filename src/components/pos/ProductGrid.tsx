import React, { useState, useMemo } from 'react';
import { Product, ProductVariant } from '../../types/pos.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { ProductCard } from './ProductCard.tsx';
import { VariantSelectorModal } from './VariantSelectorModal.tsx';
import { PackageX, Sparkles } from 'lucide-react';

interface ProductGridProps {
  selectedCategoryId: string;
  searchTerm: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  selectedCategoryId,
  searchTerm
}) => {
  const { products, addToCart } = usePOS();
  const [activeVariantProduct, setActiveVariantProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    let list = products.filter(p => p.active);

    // Filter by Category
    if (selectedCategoryId === 'cat_fav') {
      list = list.filter(p => p.isFavorite);
    } else if (selectedCategoryId !== 'cat_all') {
      list = list.filter(p => p.categoryId === selectedCategoryId);
    }

    // Filter by Search (Name, SKU, Barcode)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, selectedCategoryId, searchTerm]);

  const handleProductClick = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      setActiveVariantProduct(product);
    } else {
      addToCart(product);
    }
  };

  const handleVariantConfirm = (variant: ProductVariant, quantity: number, notes?: string) => {
    if (activeVariantProduct) {
      addToCart(activeVariantProduct, variant, quantity, notes);
      setActiveVariantProduct(null);
    }
  };

  return (
    <div className="flex-1 theme-app-bg p-4 overflow-y-auto">
      {filteredProducts.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 mb-3">
            <PackageX className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No products found</h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            {searchTerm
              ? `No items match "${searchTerm}". Try checking for spelling or scan another barcode.`
              : 'There are no active products in this category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 pb-24 lg:pb-8">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={handleProductClick}
            />
          ))}
        </div>
      )}

      {/* Variant Selector Modal */}
      {activeVariantProduct && (
        <VariantSelectorModal
          product={activeVariantProduct}
          isOpen={!!activeVariantProduct}
          onClose={() => setActiveVariantProduct(null)}
          onConfirm={handleVariantConfirm}
        />
      )}
    </div>
  );
};
