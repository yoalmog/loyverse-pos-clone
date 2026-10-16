import React, { useState, useEffect } from 'react';
import { Sale } from '../../types/pos.ts';
import { Printer } from '../../types/printer.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { PrinterService } from '../../services/PrinterService.ts';
import {
  Printer as PrinterIcon,
  Mail,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Send,
  Clock
} from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  isOpen: boolean;
  onClose: () => void;
  onNewSale: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  isOpen,
  onClose,
  onNewSale
}) => {
  const {
    settings,
    showToast,
    formatCurrency,
    formatDate,
    formatTime,
    translateProductName,
    t
  } = usePOS();

  const [emailInput, setEmailInput] = useState<string>('');
  const [showEmailForm, setShowEmailForm] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printPendingNotice, setPrintPendingNotice] = useState<boolean>(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [showChangePrinter, setShowChangePrinter] = useState<boolean>(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [availablePrinters, setAvailablePrinters] = useState<Printer[]>([]);

  useEffect(() => {
    const list = PrinterService.getPrinters();
    setAvailablePrinters(list);
    if (list.length > 0) {
      setSelectedPrinterId(list[0].id);
    }
  }, []);

  const handlePrint = async (printerIdToUse?: string) => {
    setIsPrinting(true);
    setPrintError(null);

    try {
      const res = await PrinterService.printReceipt(sale, {
        printerId: printerIdToUse || selectedPrinterId || undefined
      });

      if (res.success) {
        setPrintPendingNotice(false);
        showToast({
          type: 'success',
          title: t('toasts.printSuccess', 'Receipt Printed'),
          message: t('toasts.receiptDispatched', 'Receipt transmitted to printer.')
        });
      } else {
        // Section 13: Sale remains COMPLETED. Show "Sale completed. Receipt is waiting to print."
        setPrintPendingNotice(true);
        setPrintError(res.error || 'Configured printer offline or unreachable.');
      }
    } catch (err: any) {
      setPrintPendingNotice(true);
      setPrintError(err?.message || 'Printer communication error.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Section 12: Auto-Print receipt on payment completion if enabled
  useEffect(() => {
    if (isOpen && settings.autoPrintReceipts !== false) {
      handlePrint();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    // Generate text receipt
    const lines = [
      '========================================',
      `          ${settings.name.toUpperCase()}          `,
      `       ${settings.address}       `,
      `          ${settings.phone}          `,
      `          Tax ID: ${settings.taxId}          `,
      '========================================',
      `${t('receipt.receiptNo', 'RECEIPT')}: ${sale.receiptNumber}`,
      `${t('receipt.date', 'DATE')}: ${formatDate(sale.createdAt)} ${formatTime(sale.createdAt)}`,
      `${t('receipt.cashier', 'CASHIER')}: ${sale.employeeName}`,
      sale.customerName ? `${t('receipt.customer', 'CUSTOMER')}: ${sale.customerName}` : '',
      '----------------------------------------',
      ...sale.items.map(
        i =>
          `${translateProductName(i.productId, i.productName).padEnd(24)} ${i.quantity}x  ${formatCurrency(i.unitPrice * i.quantity).padStart(8)}`
      ),
      '----------------------------------------',
      `${t('receipt.subtotal', 'SUBTOTAL')}:                   ${formatCurrency(sale.subtotal)}`,
      sale.discountAmount > 0
        ? `${t('receipt.discount', 'DISCOUNT')}:                  -${formatCurrency(sale.discountAmount)}`
        : '',
      `${t('receipt.tax', 'TAX')} (${(sale.taxRate * 100).toFixed(2)}%):                 ${formatCurrency(sale.taxAmount)}`,
      `${t('receipt.total', 'TOTAL')}:                      ${formatCurrency(sale.total)}`,
      '----------------------------------------',
      ...sale.payments.map(
        p =>
          `${t('receipt.payment', 'PAYMENT')} (${p.method.toUpperCase()}):         ${formatCurrency(p.amount)}${
            p.tendered !== undefined ? `\n${t('receipt.tender', 'TENDERED')}:                   ${formatCurrency(p.tendered)}` : ''
          }${
            p.change !== undefined ? `\n${t('receipt.change', 'CHANGE')}:                     ${formatCurrency(p.change)}` : ''
          }`
      ),
      '========================================',
      `  ${settings.receiptFooter || t('receipt.thankYou', 'Thank you for your business!')}  `,
      '========================================'
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${sale.receiptNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: t('toasts.savedSuccessfully', 'Receipt Downloaded') });
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    showToast({
      type: 'success',
      title: t('checkout.emailReceipt', 'Digital Receipt Sent'),
      message: `${t('checkout.emailReceipt', 'Receipt dispatched to')} ${emailInput}`
    });
    setShowEmailForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Success Banner */}
        <div className="bg-emerald-600 text-white p-5 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-bold">{t('checkout.paymentSuccess', 'Payment Complete')}</h3>
          <p className="text-xs text-emerald-100 mt-0.5">
            {t('receipt.receiptNo', 'Receipt #')}: {sale.receiptNumber} · {formatCurrency(sale.total)}
          </p>
        </div>

        {/* Section 13 Notice: SALE MUST NOT DEPEND ON PRINTER */}
        {printPendingNotice && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 text-xs text-amber-950 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-full bg-amber-200 text-amber-900 shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-amber-900">Sale completed. Receipt is waiting to print.</p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  {printError || 'The target hardware printer is offline or disconnected. The transaction is saved and the print job is stored in the Print Queue.'}
                </p>
              </div>
            </div>

            {showChangePrinter ? (
              <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">Select Alternative Printer:</label>
                <select
                  value={selectedPrinterId}
                  onChange={e => setSelectedPrinterId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                >
                  {availablePrinters.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.connectionType.toUpperCase()})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePrinter(false);
                      handlePrint(selectedPrinterId);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
                  >
                    Print to Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangePrinter(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={() => handlePrint()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPrinting ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </button>

                {availablePrinters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowChangePrinter(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Change Printer</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPrintPendingNotice(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-200/60 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg transition-colors cursor-pointer ml-auto"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Print Later</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Thermal Receipt Preview Paper */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs font-mono text-xs text-slate-800 space-y-3">
            {/* Header */}
            <div className="text-center space-y-1">
              {settings.logoUrl && (
                <div className="flex justify-center mb-1.5">
                  <img
                    src={settings.logoUrl}
                    alt={settings.name}
                    className="h-10 w-auto max-w-[140px] object-contain rounded filter grayscale contrast-125"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h4 className="font-bold text-sm tracking-tight font-sans text-slate-900">{settings.name}</h4>
              <p className="text-[11px] text-slate-500">{settings.address}</p>
              <p className="text-[11px] text-slate-500">{settings.phone}</p>
              {settings.taxId && <p className="text-[10px] text-slate-400">Tax ID: {settings.taxId}</p>}
            </div>

            <div className="border-t border-dashed border-slate-300 pt-2 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>{t('receipt.receiptNo', 'Receipt #')}:</span>
                <span className="font-bold">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('receipt.date', 'Date')}:</span>
                <span>{formatDate(sale.createdAt)} {formatTime(sale.createdAt)}</span>
              </div>
              {settings.showCashier && (
                <div className="flex justify-between">
                  <span>{t('receipt.cashier', 'Cashier')}:</span>
                  <span>{sale.employeeName}</span>
                </div>
              )}
              {sale.customerName && settings.showCustomer && (
                <div className="flex justify-between text-blue-700 font-semibold">
                  <span>{t('receipt.customer', 'Customer')}:</span>
                  <span>{sale.customerName}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5">
              {sale.items.map(item => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <div className="truncate pr-2">
                    <span>{item.quantity}x {translateProductName(item.productId, item.productName)}</span>
                    {item.variantName && <span className="text-[10px] text-slate-500 block">({item.variantName})</span>}
                  </div>
                  <span className="font-bold shrink-0">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>

            {/* Financial summary */}
            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>{t('receipt.subtotal', 'Subtotal')}:</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>{t('receipt.discount', 'Discount')}:</span>
                  <span>-{formatCurrency(sale.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t('receipt.tax', 'Tax')} ({(sale.taxRate * 100).toFixed(2)}%):</span>
                <span>{formatCurrency(sale.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-dashed border-slate-300 pt-1 text-slate-900">
                <span>{t('receipt.total', 'TOTAL')}:</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>

            {/* Payments */}
            <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5 text-[11px]">
              {sale.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{t('receipt.payment', 'Payment')} ({p.method.toUpperCase()}):</span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-dashed border-slate-300 pt-3 text-center space-y-1 text-[11px] text-slate-500">
              <p>{settings.receiptFooter || 'Thank you for your business!'}</p>
            </div>
          </div>

          {/* Email receipt form inline */}
          {showEmailForm && (
            <form onSubmit={handleSendEmail} className="mt-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  required
                  placeholder="customer@domain.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="flex-1 text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('common.done', 'Send')}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePrint()}
              disabled={isPrinting}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <PrinterIcon className={`w-4 h-4 text-slate-600 ${isPrinting ? 'animate-spin' : ''}`} />
              <span>{isPrinting ? 'Printing...' : t('receipt.print', 'Print')}</span>
            </button>

            <button
              onClick={() => setShowEmailForm(prev => !prev)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              <span>{t('receipt.email', 'Email')}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>{t('receipt.download', 'Download')}</span>
            </button>
          </div>

          <button
            onClick={onNewSale}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {t('checkout.newSale', 'START NEW SALE')}
          </button>
        </div>
      </div>
    </div>
  );
};
