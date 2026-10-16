import React, { useState, useCallback } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Product, ProductVariant } from '../../types/pos.ts';
import { ProductRepository } from '../../services/repositories/ProductRepository.ts';
import { AudioFeedbackService } from '../../utils/audioFeedback.ts';
import { useHardwareBarcodeScanner } from '../../hooks/useHardwareBarcodeScanner.ts';
import { CategoryPanel } from './CategoryPanel.tsx';
import { ProductGrid } from './ProductGrid.tsx';
import { CartPanel } from './CartPanel.tsx';
import { CustomerSelectorModal } from './CustomerSelectorModal.tsx';
import { DiscountModal } from './DiscountModal.tsx';
import { HeldOrdersModal } from './HeldOrdersModal.tsx';
import { BarcodeScannerModal } from './BarcodeScannerModal.tsx';
import { VariantSelectorModal } from './VariantSelectorModal.tsx';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface POSScreenProps {
  searchTerm: string;
}

export const POSScreen: React.FC<POSScreenProps> = ({ searchTerm }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('cat_all');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [activeVariantProduct, setActiveVariantProduct] = useState<Product | null>(null);

  const {
    cartItems,
    grandTotal,
    formatCurrency,
    t,
    currentStoreId,
    addToCart,
    showToast,
    openBarcodeScannerModal,
    setOpenBarcodeScannerModal
  } = usePOS();

  const totalItemCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  // --------------------------------------------------------------------------
  // Hardware Barcode Scanner Listener (USB, Bluetooth, and HID 2.4G scanners)
  // --------------------------------------------------------------------------
  const handleHardwareBarcodeScanned = useCallback(
    async (code: string) => {
      try {
        const result = await ProductRepository.lookupBarcode(code, currentStoreId);

        if (result) {
          AudioFeedbackService.playBarcodeSuccess();

          if (result.matchedVariant) {
            addToCart(result.product, result.matchedVariant, 1);
            showToast({
              type: 'success',
              title: t('barcode.scannedTitle', 'Barcode Scanned'),
              message: `${result.product.name} (${result.matchedVariant.name}) added to cart.`
            });
          } else if (result.product.variants && result.product.variants.length > 0) {
            setActiveVariantProduct(result.product);
            showToast({
              type: 'info',
              title: t('barcode.scannedTitle', 'Barcode Scanned'),
              message: `Select option for ${result.product.name}.`
            });
          } else {
            addToCart(result.product, undefined, 1);
            showToast({
              type: 'success',
              title: t('barcode.scannedTitle', 'Barcode Scanned'),
              message: `${result.product.name} added to cart.`
            });
          }
        } else {
          AudioFeedbackService.playBarcodeError();
          showToast({
            type: 'warning',
            title: t('barcode.notFoundTitle', 'Product Not Found'),
            message: `No item found for scanned code: "${code}"`
          });
        }
      } catch (err: any) {
        console.error('Hardware barcode scan error:', err);
      }
    },
    [currentStoreId, addToCart, showToast, t]
  );

  useHardwareBarcodeScanner({
    onScan: handleHardwareBarcodeScanned,
    enabled: true
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
      {/* 1. Ticket Panel (Left on Desktop/Tablet - Loyverse POS Layout) */}
      <CartPanel
        isOpenOnMobile={isMobileCartOpen}
        onCloseMobile={() => setIsMobileCartOpen(false)}
      />

      {/* 2. Catalog View (Right on Desktop/Tablet - Category Tabs on Top, Product Grid Below) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <CategoryPanel
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
        <ProductGrid
          selectedCategoryId={selectedCategoryId}
          searchTerm={searchTerm}
        />
      </div>

      {/* 3. Mobile Floating Cart Summary Button (< lg) */}
      {cartItems.length > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-4 inset-x-4 z-30">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--theme-primary)] hover:opacity-90 active:scale-[0.99] text-white rounded-2xl shadow-xl border border-white/20 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-xs font-bold font-mono">
                {totalItemCount}
              </div>
              <span className="text-sm font-bold">{t('pos.viewOrder', 'View Current Order')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black font-mono">{formatCurrency(grandTotal)}</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Reusable POS Modals */}
      <CustomerSelectorModal />
      <DiscountModal />
      <HeldOrdersModal />

      {/* Camera & Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={openBarcodeScannerModal}
        onClose={() => setOpenBarcodeScannerModal(false)}
      />

      {/* Variant Selector for barcode scans with multiple variants */}
      {activeVariantProduct && (
        <VariantSelectorModal
          product={activeVariantProduct}
          isOpen={!!activeVariantProduct}
          onClose={() => setActiveVariantProduct(null)}
          onConfirm={(variant, quantity, notes) => {
            addToCart(activeVariantProduct, variant, quantity, notes);
            setActiveVariantProduct(null);
          }}
        />
      )}
    </div>
  );
};
