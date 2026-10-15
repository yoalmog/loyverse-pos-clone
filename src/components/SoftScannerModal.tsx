'use client';

import React, { useState } from 'react';
import { X, Barcode, Scan, Search, Plus, Check, Camera } from 'lucide-react';
import { soundFeedback } from '@/lib/accessibility';
import { nativeBridgeService } from '@/lib/native-bridge';

interface SoftScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  onProductScanned: (product: any) => void;
}

export function SoftScannerModal({
  isOpen,
  onClose,
  products,
  onProductScanned,
}: SoftScannerModalProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScanned, setLastScanned] = useState<any>(null);

  if (!isOpen) return null;

  const handleScanCode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    const matched = products.find(
      (p) => p.barcode === clean || p.sku === clean || p.id === clean
    );

    if (matched) {
      soundFeedback.playBarcodeBeep();
      setLastScanned(matched);
      setErrorMsg('');
      setBarcodeInput('');
      onProductScanned(matched);
    } else {
      soundFeedback.playErrorBuzz();
      setErrorMsg(`Código "${clean}" no encontrado en el catálogo.`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScanCode(barcodeInput);
  };

  // Filter products that have a barcode or SKU for quick testing
  const barcodedProducts = products.filter((p) => p.barcode || p.sku).slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Lector de Código de Barras</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-5">
          {/* Simulated Scanner Visualizer */}
          <div className="relative flex h-28 flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
            <Barcode className="h-14 w-32 text-slate-600 stroke-[1.5]" />
            <span className="mt-1 text-[11px] text-slate-400 font-mono">
              [ Escáner USB/Bluetooth activo ]
            </span>
          </div>

          {/* Manual & Camera Input Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Ingresar código o SKU manualmente..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95"
            >
              <Search className="h-4 w-4" />
              Escanear
            </button>
            <button
              type="button"
              onClick={async () => {
                const code = await nativeBridgeService.scanBarcodeWithCamera();
                if (code) handleScanCode(code);
              }}
              title="Escanear con Cámara (Android WebView Bridge)"
              className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Cámara</span>
            </button>
          </form>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 p-2.5 text-center text-xs font-medium text-rose-400 border border-rose-500/20">
              {errorMsg}
            </div>
          )}

          {lastScanned && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-white">¡Añadido: {lastScanned.name}!</span>
              </div>
              <span className="text-[11px] text-emerald-300">
                S/ {(lastScanned.price / 100).toFixed(2)}
              </span>
            </div>
          )}

          {/* Quick Click Demo Barcodes */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Códigos de Prueba Rápidos (Haga clic para simular):
            </div>
            <div className="grid grid-cols-2 gap-2">
              {barcodedProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleScanCode(p.barcode || p.sku)}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-2 text-left text-xs transition-colors hover:border-slate-700 hover:bg-slate-800 active:scale-95"
                >
                  <div className="truncate">
                    <div className="truncate font-medium text-white">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.barcode || p.sku}</div>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 p-4">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
