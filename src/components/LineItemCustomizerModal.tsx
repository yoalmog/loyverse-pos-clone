'use client';

import React, { useState } from 'react';
import { X, Tag, FileText, Check, Percent, DollarSign } from 'lucide-react';
import { soundFeedback } from '@/lib/accessibility';

interface LineItemCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    itemNote?: string;
    itemDiscountPercent?: number;
    itemDiscountFixed?: number;
  };
  currencySymbol: string;
  onSave: (updates: { itemNote?: string; itemDiscountPercent?: number; itemDiscountFixed?: number }) => void;
}

export function LineItemCustomizerModal({
  isOpen,
  onClose,
  item,
  currencySymbol,
  onSave,
}: LineItemCustomizerModalProps) {
  const [note, setNote] = useState(item.itemNote || '');
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FIXED'>(
    item.itemDiscountPercent ? 'PERCENT' : item.itemDiscountFixed ? 'FIXED' : 'NONE'
  );
  const [discountValue, setDiscountValue] = useState(
    item.itemDiscountPercent
      ? String(item.itemDiscountPercent)
      : item.itemDiscountFixed
      ? String((item.itemDiscountFixed / 100).toFixed(2))
      : ''
  );

  if (!isOpen) return null;

  const quickNotes = [
    'Sin cebolla',
    'Extra caliente',
    'Sin hielo',
    'Salsa aparte',
    'Poco dulce',
    'Para llevar',
    'Bien cocido',
    'Término medio',
  ];

  const handleApply = () => {
    let itemDiscountPercent: number | undefined = undefined;
    let itemDiscountFixed: number | undefined = undefined;

    const val = parseFloat(discountValue) || 0;
    if (discountType === 'PERCENT' && val > 0) {
      itemDiscountPercent = Math.min(100, Math.max(0, val));
    } else if (discountType === 'FIXED' && val > 0) {
      itemDiscountFixed = Math.round(val * 100);
    }

    onSave({
      itemNote: note.trim() || undefined,
      itemDiscountPercent,
      itemDiscountFixed,
    });
    soundFeedback.playClick();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-bold text-white">{item.productName}</h3>
            <p className="text-[11px] text-slate-400">
              Personalizar nota de cocina y descuento por línea
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 p-5">
          {/* Note Input */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <FileText className="h-4 w-4 text-emerald-400" />
              Nota de Preparación / Cocina
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Extra caliente, sin azúcar, salsa aparte..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            {/* Quick Note Pills */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickNotes.map((qn) => (
                <button
                  key={qn}
                  type="button"
                  onClick={() => {
                    setNote((prev) => (prev ? `${prev}, ${qn}` : qn));
                    soundFeedback.playClick();
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-700 hover:bg-slate-800 active:scale-95"
                >
                  + {qn}
                </button>
              ))}
            </div>
          </div>

          {/* Line-Item Discount */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Tag className="h-4 w-4 text-emerald-400" />
              Descuento por Artículo
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('NONE')}
                className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                  discountType === 'NONE'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-800 text-slate-400'
                }`}
              >
                Sin Descuento
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('PERCENT')}
                className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                  discountType === 'PERCENT'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-800 text-slate-400'
                }`}
              >
                <Percent className="h-3 w-3" /> Porcentaje (%)
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('FIXED')}
                className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                  discountType === 'FIXED'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-800 text-slate-400'
                }`}
              >
                <DollarSign className="h-3 w-3" /> Fijo ({currencySymbol})
              </button>
            </div>

            {discountType !== 'NONE' && (
              <div className="mt-3">
                <input
                  type="number"
                  min="0"
                  max={discountType === 'PERCENT' ? '100' : undefined}
                  step={discountType === 'PERCENT' ? '1' : '0.50'}
                  placeholder={discountType === 'PERCENT' ? 'Porcentaje de descuento (ej: 10)' : `Monto de descuento (ej: 5.00)`}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95"
          >
            <Check className="h-4 w-4" />
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
