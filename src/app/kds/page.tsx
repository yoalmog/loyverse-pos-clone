'use client';

import React from 'react';
import { POSProvider } from '@/context/POSContext.tsx';
import { KitchenDisplayView } from '@/components/kds/KitchenDisplayView.tsx';
import { ToastContainer } from '@/components/common/ToastContainer.tsx';

export default function DedicatedKdsPage() {
  return (
    <POSProvider>
      <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col font-sans select-none">
        <KitchenDisplayView />
        <ToastContainer />
      </div>
    </POSProvider>
  );
}
