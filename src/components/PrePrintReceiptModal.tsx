'use client';

import React from 'react';
import { X, Printer, Check, ArrowRight } from 'lucide-react';
import { soundFeedback } from '@/lib/accessibility';

interface PrePrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    receiptNumber: string;
    cashierName: string;
    customerName?: string;
    diningOptionName?: string;
    items: any[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    paymentMethod: string;
    cashTendered?: number | null;
    changeDue?: number | null;
    createdAt?: string;
  };
  store: {
    name?: string;
    address?: string;
    phone?: string;
    tax_id?: string;
    receipt_header?: string;
    receipt_footer?: string;
  };
  currencySymbol: string;
  onConfirmAndPrint?: () => void;
}

export function PrePrintReceiptModal({
  isOpen,
  onClose,
  order,
  store,
  currencySymbol,
  onConfirmAndPrint,
}: PrePrintReceiptModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    soundFeedback.playClick();
    if (onConfirmAndPrint) {
      onConfirmAndPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Vista Previa de Ticket</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Realistic Thermal Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="receipt-paper rounded-xl bg-white p-5 font-mono text-[11px] leading-tight text-black shadow-inner">
            {/* Header */}
            <div className="text-center">
              <div className="text-sm font-black tracking-wider uppercase">{store?.name || 'CAFÉ DEL PARQUE'}</div>
              {store?.tax_id && <div className="text-[10px]">RUC: {store.tax_id}</div>}
              {store?.address && <div className="text-[10px]">{store.address}</div>}
              {store?.phone && <div className="text-[10px]">Tel: {store.phone}</div>}
              {store?.receipt_header && <div className="mt-1 text-[10px] italic">{store.receipt_header}</div>}
            </div>

            <div className="my-2 border-b border-dashed border-neutral-400" />

            {/* Metadata */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Ticket:</span>
                <span className="font-bold">{order.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Fecha:</span>
                <span>{order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cajero:</span>
                <span>{order.cashierName || 'Cajero 1'}</span>
              </div>
              {order.customerName && (
                <div className="flex justify-between">
                  <span>Cliente:</span>
                  <span className="font-bold">{order.customerName}</span>
                </div>
              )}
              {order.diningOptionName && (
                <div className="flex justify-between">
                  <span>Servicio:</span>
                  <span>{order.diningOptionName}</span>
                </div>
              )}
            </div>

            <div className="my-2 border-b border-dashed border-neutral-400" />

            {/* Items */}
            <div className="space-y-1.5">
              {order.items.map((it: any, idx: number) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="font-bold">
                      {it.quantity}x {it.productName || it.product_name}
                    </span>
                    <span>{currencySymbol} {((it.total || 0) / 100).toFixed(2)}</span>
                  </div>
                  {it.variationName && (
                    <div className="text-[9px] text-neutral-600 pl-3">[{it.variationName}]</div>
                  )}
                  {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                    <div className="text-[9px] text-neutral-600 pl-3">
                      {it.selectedModifiers.map((m: any) => `+ ${m.name}`).join(', ')}
                    </div>
                  )}
                  {it.itemNote && (
                    <div className="text-[9px] italic text-neutral-600 pl-3">Nota: {it.itemNote}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="my-2 border-b border-dashed border-neutral-400" />

            {/* Totals */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{currencySymbol} {(order.subtotal / 100).toFixed(2)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Descuento:</span>
                  <span>- {currencySymbol} {(order.discountTotal / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>IGV (18%):</span>
                <span>{currencySymbol} {(order.taxTotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 text-xs font-black">
                <span>TOTAL:</span>
                <span>{currencySymbol} {(order.total / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="my-2 border-b border-dashed border-neutral-400" />

            {/* Payment detail */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Método de pago:</span>
                <span className="font-bold">{order.paymentMethod}</span>
              </div>
              {order.cashTendered != null && (
                <div className="flex justify-between">
                  <span>Efectivo recibido:</span>
                  <span>{currencySymbol} {(order.cashTendered / 100).toFixed(2)}</span>
                </div>
              )}
              {order.changeDue != null && (
                <div className="flex justify-between font-bold">
                  <span>Vuelto:</span>
                  <span>{currencySymbol} {(order.changeDue / 100).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-[9px] text-neutral-600">
              {store?.receipt_footer ? (
                <div>{store.receipt_footer}</div>
              ) : (
                <div>¡Gracias por su preferencia! Vuelva pronto.</div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 p-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Imprimir Comprobante
          </button>
        </div>
      </div>
    </div>
  );
}
