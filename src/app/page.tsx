'use client';

import React, { useState } from 'react';
import { POSProvider, usePOS } from '@/context/POSContext.tsx';
import { Sidebar } from '@/components/common/Sidebar.tsx';
import { Header } from '@/components/common/Header.tsx';
import { PinLockScreen } from '@/components/common/PinLockScreen.tsx';
import { ToastContainer } from '@/components/common/ToastContainer.tsx';
import { OwnerAuthModal } from '@/components/common/OwnerAuthModal.tsx';
import { POSScreen } from '@/components/pos/POSScreen.tsx';
import { CheckoutScreen } from '@/components/pos/CheckoutScreen.tsx';
import { SalesView } from '@/components/sales/SalesView.tsx';
import { ProductsView } from '@/components/products/ProductsView.tsx';
import { CategoriesView } from '@/components/categories/CategoriesView.tsx';
import { InventoryView } from '@/components/inventory/InventoryView.tsx';
import { CustomersView } from '@/components/customers/CustomersView.tsx';
import { EmployeesView } from '@/components/employees/EmployeesView.tsx';
import { ReportsView } from '@/components/reports/ReportsView.tsx';
import { DiscountsView } from '@/components/discounts/DiscountsView.tsx';
import { SettingsView } from '@/components/settings/SettingsView.tsx';
import { MenuScannerView } from '@/components/menu-scanner/MenuScannerView.tsx';
import { BackOfficeView } from '@/components/backoffice/BackOfficeView.tsx';
import { KitchenDisplayView } from '@/components/kds/KitchenDisplayView.tsx';
import { AccessibilityLiveAnnouncer } from '@/components/common/AccessibilityLiveAnnouncer.tsx';

const POSAppContent: React.FC = () => {
  const { activeRoute, isPinLocked, products, addToCart, showToast } = usePOS();
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Hardware Barcode Scanner handler (press Enter or auto scanner)
  const handleBarcodeScan = (code: string) => {
    const matched = products.find(
      p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setSearchTerm('');
      showToast({
        type: 'success',
        title: 'Barcode Scanned',
        message: `${matched.name} added to cart.`
      });
    } else {
      showToast({
        type: 'warning',
        title: 'Barcode Not Found',
        message: `No item matched code: "${code}"`
      });
    }
  };

  return (
    <div className="flex h-screen theme-app-bg text-slate-900 overflow-hidden font-sans select-none">
      {/* 1. Global Sidebar Navigation */}
      <Sidebar />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <Header
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onBarcodeScan={handleBarcodeScan}
        />

        {/* View Switcher */}
        <main className="flex-1 flex overflow-hidden theme-app-bg">
          {activeRoute === 'pos' && <POSScreen searchTerm={searchTerm} />}
          {activeRoute === 'checkout' && <CheckoutScreen />}
          {activeRoute === 'sales' && <SalesView />}
          {activeRoute === 'products' && <ProductsView />}
          {activeRoute === 'categories' && <CategoriesView />}
          {activeRoute === 'menu-scanner' && <MenuScannerView />}
          {activeRoute === 'inventory' && <InventoryView />}
          {activeRoute === 'customers' && <CustomersView />}
          {activeRoute === 'employees' && <EmployeesView />}
          {activeRoute === 'reports' && <ReportsView />}
          {activeRoute === 'discounts' && <DiscountsView />}
          {activeRoute === 'settings' && <SettingsView />}
          {activeRoute === 'backoffice' && <BackOfficeView />}
          {activeRoute === 'kds' && <KitchenDisplayView />}
        </main>
      </div>

      {/* Security PIN Lock Overlay */}
      {isPinLocked && <PinLockScreen />}

      {/* Global Notification Toasts */}
      <ToastContainer />

      {/* Store Owner Authorization Verification */}
      <OwnerAuthModal />

      {/* Screen Reader Live Region Announcer */}
      <AccessibilityLiveAnnouncer />
    </div>
  );
};

export default function App() {
  return (
    <POSProvider>
      <POSAppContent />
    </POSProvider>
  );
}
