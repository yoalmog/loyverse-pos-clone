import React, { useState, useEffect, useMemo } from 'react';
import { Sale } from '../../types/pos.ts';
import { Printer } from '../../types/printer.ts';
import { usePOS } from '../../context/POSContext.tsx';
import { PrinterService } from '../../services/PrinterService.ts';
import { EscPosGenerator } from '../../utils/EscPosGenerator.ts';
import QRCode from 'qrcode';
import {
  Printer as PrinterIcon,
  Download,
  X,
  Eye,
  Check,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Receipt,
  Sparkles,
  QrCode,
  Award,
  Star,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  Percent,
  RotateCcw,
  Image as ImageIcon,
  Share2,
  Save
} from 'lucide-react';

interface PreviewReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onConfirmPaymentAndPrint?: () => void;
}

export const PreviewReceiptModal: React.FC<PreviewReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  onConfirmPaymentAndPrint
}) => {
  const {
    settings,
    updateSettings,
    showToast,
    formatCurrency,
    formatDate,
    formatTime,
    translateProductName,
    customers,
    t
  } = usePOS();

  // View state: 'thermal' (visual thermal paper) or 'escpos' (raw monospace text simulation)
  const [viewMode, setViewMode] = useState<'thermal' | 'escpos'>('thermal');
  // Paper width simulation: 80mm (48 characters) or 58mm (32 characters)
  const [paperWidth, setPaperWidth] = useState<80 | 58>(80);

  const [availablePrinters, setAvailablePrinters] = useState<Printer[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatusMessage, setPrintStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Field toggles with defaults from settings
  const [fieldToggles, setFieldToggles] = useState({
    showStoreLogo: settings.showStoreLogo !== false,
    showTaxBreakdown: settings.showTaxBreakdown !== false,
    showLoyaltyPoints: settings.showLoyaltyPoints !== false,
    showReturnPolicy: settings.showReturnPolicy !== false,
    showReceiptQrCode: settings.showReceiptQrCode !== false
  });

  const [showFieldConfigBar, setShowFieldConfigBar] = useState<boolean>(false);

  // Sync field toggles when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setFieldToggles({
        showStoreLogo: settings.showStoreLogo !== false,
        showTaxBreakdown: settings.showTaxBreakdown !== false,
        showLoyaltyPoints: settings.showLoyaltyPoints !== false,
        showReturnPolicy: settings.showReturnPolicy !== false,
        showReceiptQrCode: settings.showReceiptQrCode !== false
      });
    }
  }, [isOpen, settings]);

  // Transaction ID used for dynamic QR code generation
  const transactionId = useMemo(() => {
    return sale.id || `TXN-${sale.receiptNumber}`;
  }, [sale.id, sale.receiptNumber]);

  // Points earned calculation for loyalty
  const pointsEarned = useMemo(() => {
    return Math.floor(sale.total * (settings.pointsPerDollar || 1));
  }, [sale.total, settings.pointsPerDollar]);

  // Linked customer rewards balance lookup
  const customerLoyaltyBalance = useMemo(() => {
    if (!sale.customerId && !sale.customerName) return null;
    const found = customers.find(c => c.id === sale.customerId || `${c.firstName} ${c.lastName}` === sale.customerName);
    return found ? found.loyaltyPoints + pointsEarned : pointsEarned + 120;
  }, [sale.customerId, sale.customerName, customers, pointsEarned]);

  // Dynamic QR Code payload construction
  const qrTargetUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aurapos.app';
    const txn = encodeURIComponent(transactionId);
    const rcpt = encodeURIComponent(sale.receiptNumber);

    if (settings.receiptQrType === 'feedback_survey') {
      const surveyUrl = settings.feedbackSurveyUrl || `${origin}/feedback`;
      return `${surveyUrl}?txn=${txn}&rcpt=${rcpt}&store=${encodeURIComponent(settings.id || 'main')}`;
    } else if (settings.receiptQrType === 'both') {
      return `${origin}/receipt?txn=${txn}&rcpt=${rcpt}&feedback=1`;
    } else {
      // digital_receipt
      return `${origin}/receipt?txn=${txn}&rcpt=${rcpt}`;
    }
  }, [transactionId, sale.receiptNumber, settings.receiptQrType, settings.feedbackSurveyUrl, settings.id]);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Generate QR Code image data URL dynamically
  useEffect(() => {
    if (isOpen && fieldToggles.showReceiptQrCode) {
      QRCode.toDataURL(qrTargetUrl, {
        margin: 1,
        width: 130,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Failed to generate receipt QR code:', err));
    }
  }, [isOpen, qrTargetUrl, fieldToggles.showReceiptQrCode]);

  // Interactive Digital Receipt & Customer Feedback Dialog state
  const [showDigitalReceiptDialog, setShowDigitalReceiptDialog] = useState<boolean>(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Friendly Service', 'Quick Checkout']);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const list = PrinterService.getPrinters();
      setAvailablePrinters(list);
      const defaultPrinter = list.find(p => p.isDefault || p.printerPurpose === 'receipt') || list[0];
      if (defaultPrinter) {
        setSelectedPrinterId(defaultPrinter.id);
        if (defaultPrinter.paperWidth === 58 || defaultPrinter.paperWidth === 80) {
          setPaperWidth(defaultPrinter.paperWidth);
        }
      }
      setPrintStatusMessage(null);
      setFeedbackSubmitted(false);
    }
  }, [isOpen]);

  // Save current field toggles to store settings permanently
  const handleSaveTogglesToSettings = () => {
    updateSettings({
      ...settings,
      showStoreLogo: fieldToggles.showStoreLogo,
      showTaxBreakdown: fieldToggles.showTaxBreakdown,
      showLoyaltyPoints: fieldToggles.showLoyaltyPoints,
      showReturnPolicy: fieldToggles.showReturnPolicy,
      showReceiptQrCode: fieldToggles.showReceiptQrCode
    });
    showToast({
      type: 'success',
      title: 'Receipt Configuration Saved',
      message: 'New layout preferences saved as store defaults.'
    });
  };

  // Generate simulated ESC/POS raw text representation for Monospace view
  const escposText = useMemo(() => {
    const cols = paperWidth === 58 ? 32 : 48;
    const gen = new EscPosGenerator(cols);

    gen.initialize().setAlignment('center');

    // 1. Store Logo & Name
    if (fieldToggles.showStoreLogo) {
      gen.line('[STORE LOGO]');
    }

    gen.setBold(true).line(settings.name || 'AURA POS').setBold(false);

    if (settings.address) gen.line(settings.address);
    if (settings.phone) gen.line(`Tel: ${settings.phone}`);
    if (settings.taxId) gen.line(`Tax ID: ${settings.taxId}`);
    if (settings.receiptHeader) gen.line(settings.receiptHeader);

    gen
      .doubleSeparator('=')
      .setAlignment('left')
      .line(`RECEIPT: #${sale.receiptNumber}`)
      .line(`DATE:    ${formatDate(sale.createdAt)} ${formatTime(sale.createdAt)}`);

    if (settings.showCashier !== false) {
      gen.line(`CASHIER: ${sale.employeeName}`);
    }

    if (sale.customerName && settings.showCustomer !== false) {
      gen.line(`CLIENT:  ${sale.customerName}`);
    }

    gen.separator('-');

    const qtyColWidth = 4;
    const priceColWidth = 8;
    const itemColWidth = Math.max(8, cols - qtyColWidth - priceColWidth);

    gen.columns([
      { text: 'ITEM', width: itemColWidth, align: 'left' },
      { text: 'QTY', width: qtyColWidth, align: 'right' },
      { text: 'TOTAL', width: priceColWidth, align: 'right' }
    ]);
    gen.separator('-');

    for (const item of sale.items) {
      const name = translateProductName(item.productId, item.productName);
      const priceStr = formatCurrency(item.unitPrice * item.quantity);
      gen.columns([
        { text: name, width: itemColWidth, align: 'left' },
        { text: `${item.quantity}x`, width: qtyColWidth, align: 'right' },
        { text: priceStr, width: priceColWidth, align: 'right' }
      ]);
      if (item.variantName) {
        gen.line(`  (${item.variantName})`);
      }
    }

    gen.separator('-');
    gen.columns([
      { text: 'SUBTOTAL', width: cols - 10, align: 'left' },
      { text: formatCurrency(sale.subtotal), width: 10, align: 'right' }
    ]);

    if (sale.discountAmount > 0) {
      gen.columns([
        { text: 'DISCOUNT', width: cols - 10, align: 'left' },
        { text: `-${formatCurrency(sale.discountAmount)}`, width: 10, align: 'right' }
      ]);
    }

    // Tax Breakdown Toggle
    if (fieldToggles.showTaxBreakdown) {
      gen.columns([
        { text: `TAX (${(sale.taxRate * 100).toFixed(1)}%)`, width: cols - 10, align: 'left' },
        { text: formatCurrency(sale.taxAmount), width: 10, align: 'right' }
      ]);
    }

    gen.doubleSeparator('=');
    gen.setBold(true);
    gen.columns([
      { text: 'TOTAL DUE', width: cols - 12, align: 'left' },
      { text: formatCurrency(sale.total), width: 12, align: 'right' }
    ]);
    gen.setBold(false);
    gen.separator('-');

    // Payments
    for (const p of sale.payments) {
      gen.columns([
        { text: `PAYMENT (${p.method.toUpperCase()})`, width: cols - 12, align: 'left' },
        { text: formatCurrency(p.amount), width: 12, align: 'right' }
      ]);
      if (p.tendered !== undefined && p.tendered > 0) {
        gen.columns([
          { text: 'TENDERED', width: cols - 12, align: 'left' },
          { text: formatCurrency(p.tendered), width: 12, align: 'right' }
        ]);
      }
      if (p.change !== undefined && p.change > 0) {
        gen.columns([
          { text: 'CHANGE', width: cols - 12, align: 'left' },
          { text: formatCurrency(p.change), width: 12, align: 'right' }
        ]);
      }
    }

    // Loyalty Points Toggle
    if (fieldToggles.showLoyaltyPoints) {
      gen.separator('-');
      gen.setAlignment('left');
      gen.columns([
        { text: 'LOYALTY REWARDS', width: cols - 12, align: 'left' },
        { text: `+${pointsEarned} PTS`, width: 12, align: 'right' }
      ]);
      if (customerLoyaltyBalance !== null) {
        gen.line(`REWARDS BALANCE: ${customerLoyaltyBalance} PTS`);
      }
    }

    // Return Policy Toggle
    if (fieldToggles.showReturnPolicy) {
      gen.separator('-');
      gen.setAlignment('center');
      gen.line('RETURN & EXCHANGE POLICY:');
      gen.line(settings.returnPolicyText || 'Items in original condition may be returned or exchanged within 30 days with receipt.');
      gen.setAlignment('left');
    }

    if (sale.notes) {
      gen.separator('-');
      gen.line(`NOTES: ${sale.notes}`);
    }

    // Dynamic QR Code Toggle
    if (fieldToggles.showReceiptQrCode) {
      gen.separator('-');
      gen.setAlignment('center');
      const qrLabel =
        settings.receiptQrType === 'feedback_survey'
          ? 'SCAN FOR FEEDBACK SURVEY'
          : settings.receiptQrType === 'digital_receipt'
          ? 'SCAN FOR DIGITAL RECEIPT'
          : 'SCAN FOR DIGITAL RECEIPT & SURVEY';
      gen.line(qrLabel);
      gen.qrCode(qrTargetUrl, 5);
      gen.line(`TXN ID: ${transactionId}`);
      gen.setAlignment('left');
    }

    gen
      .doubleSeparator('=')
      .setAlignment('center')
      .line(settings.receiptFooter || 'Thank you for your business!')
      .line('*** PREVIEW COPY ***');

    return gen.toPreviewText();
  }, [
    sale,
    paperWidth,
    settings,
    fieldToggles,
    formatDate,
    formatTime,
    formatCurrency,
    translateProductName,
    pointsEarned,
    customerLoyaltyBalance,
    transactionId,
    qrTargetUrl
  ]);

  if (!isOpen) return null;

  // Handle physical print execution
  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintStatusMessage(null);

    try {
      const res = await PrinterService.printReceipt(sale, {
        printerId: selectedPrinterId || undefined
      });

      if (res.success) {
        setPrintStatusMessage({
          type: 'success',
          text: t('toasts.receiptDispatched', 'Receipt successfully transmitted to printer.')
        });
        showToast({
          type: 'success',
          title: t('toasts.printSuccess', 'Receipt Printed'),
          message: 'Physical receipt sent to hardware printer.'
        });
      } else {
        setPrintStatusMessage({
          type: 'error',
          text: res.error || 'Configured printer offline or unreachable.'
        });
        showToast({
          type: 'warning',
          title: 'Print Unsuccessful',
          message: res.error || 'Could not reach target printer.'
        });
      }
    } catch (err: any) {
      setPrintStatusMessage({
        type: 'error',
        text: err?.message || 'Printer communication error.'
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Download formatted text file
  const handleDownload = () => {
    const blob = new Blob([escposText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_Preview_${sale.receiptNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({
      type: 'success',
      title: 'Receipt Downloaded',
      message: 'Saved plain-text receipt file.'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight text-white">
                  {t('receipt.previewTitle', 'Preview Receipt')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  #{sale.receiptNumber}
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                  ID: {transactionId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect physical thermal formatting, QR code, and fields before printing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFieldConfigBar(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showFieldConfigBar
                  ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Toggle field visibility configuration bar"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configure Fields</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close preview modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Configuration Bar: Paper Width & Format Controls */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">
              Paper Width:
            </span>
            <div className="inline-flex rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setPaperWidth(80)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  paperWidth === 80
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                80mm (Standard)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth(58)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  paperWidth === 58
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                58mm (Compact)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">
              View Mode:
            </span>
            <div className="inline-flex rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('thermal')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'thermal'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Thermal Paper
              </button>
              <button
                type="button"
                onClick={() => setViewMode('escpos')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'escpos'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ESC/POS Text
              </button>
            </div>
          </div>
        </div>

        {/* Quick Receipt Field Toggles Bar (Collapsible) */}
        {showFieldConfigBar && (
          <div className="px-5 py-3 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 animate-fadeIn">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-blue-900 dark:text-blue-200 text-[11px] flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                Receipt Fields:
              </span>

              {/* Store Logo Toggle */}
              <button
                type="button"
                onClick={() => setFieldToggles(p => ({ ...p, showStoreLogo: !p.showStoreLogo }))}
                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  fieldToggles.showStoreLogo
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-blue-400 shadow-2xs'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 border-transparent opacity-60'
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                <span>Store Logo {fieldToggles.showStoreLogo ? '✓' : '✕'}</span>
              </button>

              {/* Tax Breakdown Toggle */}
              <button
                type="button"
                onClick={() => setFieldToggles(p => ({ ...p, showTaxBreakdown: !p.showTaxBreakdown }))}
                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  fieldToggles.showTaxBreakdown
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-400 shadow-2xs'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 border-transparent opacity-60'
                }`}
              >
                <Percent className="w-3 h-3" />
                <span>Tax Breakdown {fieldToggles.showTaxBreakdown ? '✓' : '✕'}</span>
              </button>

              {/* Loyalty Points Toggle */}
              <button
                type="button"
                onClick={() => setFieldToggles(p => ({ ...p, showLoyaltyPoints: !p.showLoyaltyPoints }))}
                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  fieldToggles.showLoyaltyPoints
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border-amber-400 shadow-2xs'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 border-transparent opacity-60'
                }`}
              >
                <Award className="w-3 h-3" />
                <span>Loyalty Points {fieldToggles.showLoyaltyPoints ? '✓' : '✕'}</span>
              </button>

              {/* Return Policy Toggle */}
              <button
                type="button"
                onClick={() => setFieldToggles(p => ({ ...p, showReturnPolicy: !p.showReturnPolicy }))}
                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  fieldToggles.showReturnPolicy
                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-400 shadow-2xs'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 border-transparent opacity-60'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Return Policy {fieldToggles.showReturnPolicy ? '✓' : '✕'}</span>
              </button>

              {/* Dynamic QR Code Toggle */}
              <button
                type="button"
                onClick={() => setFieldToggles(p => ({ ...p, showReceiptQrCode: !p.showReceiptQrCode }))}
                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  fieldToggles.showReceiptQrCode
                    ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 border-purple-400 shadow-2xs'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 border-transparent opacity-60'
                }`}
              >
                <QrCode className="w-3 h-3" />
                <span>Dynamic QR Code {fieldToggles.showReceiptQrCode ? '✓' : '✕'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveTogglesToSettings}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs whitespace-nowrap ml-auto"
              title="Save these field toggles as store settings default"
            >
              <Save className="w-3 h-3" />
              <span>Save As Store Default</span>
            </button>
          </div>
        )}

        {/* Status Notification Banner (if any) */}
        {printStatusMessage && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center justify-between border-b ${
              printStatusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : printStatusMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {printStatusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : printStatusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span>{printStatusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Receipt View Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center items-start">
          {viewMode === 'thermal' ? (
            /* Thermal Paper Simulation Card */
            <div
              style={{
                width: paperWidth === 58 ? '300px' : '380px'
              }}
              className="bg-white text-slate-900 p-6 rounded-sm shadow-xl border-t-8 border-b-8 border-slate-300 font-mono text-xs transition-all duration-200 relative select-text"
            >
              {/* Paper Top Jagged/Serrated Effect */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-b from-slate-200 to-transparent opacity-60" />

              {/* 1. Store Header & Branding (Logo Toggle) */}
              <div className="text-center space-y-1 mb-4">
                {fieldToggles.showStoreLogo && (
                  <div className="flex justify-center mb-2">
                    {settings.logoUrl ? (
                      <img
                        src={settings.logoUrl}
                        alt={settings.name}
                        className="h-11 w-auto max-w-[150px] object-contain rounded filter grayscale contrast-125"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="px-3 py-1 rounded bg-slate-900 text-white font-sans text-xs font-black tracking-widest uppercase">
                        {settings.name || 'AURA POS'}
                      </div>
                    )}
                  </div>
                )}
                <h4 className="font-bold text-base font-sans tracking-tight text-slate-900 leading-tight">
                  {settings.name || 'AURA POS'}
                </h4>
                {settings.address && (
                  <p className="text-[11px] text-slate-600">{settings.address}</p>
                )}
                {settings.phone && (
                  <p className="text-[11px] text-slate-600">Tel: {settings.phone}</p>
                )}
                {settings.taxId && (
                  <p className="text-[10px] text-slate-500">Tax ID: {settings.taxId}</p>
                )}
                {settings.receiptHeader && (
                  <p className="text-[11px] text-slate-700 italic pt-1">{settings.receiptHeader}</p>
                )}
              </div>

              {/* 2. Order Metadata */}
              <div className="border-t border-dashed border-slate-400 py-2 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt #:</span>
                  <span className="font-bold text-slate-900">{sale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>
                    {formatDate(sale.createdAt)} {formatTime(sale.createdAt)}
                  </span>
                </div>
                {settings.showCashier !== false && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="font-medium">{sale.employeeName}</span>
                  </div>
                )}
                {sale.customerName && settings.showCustomer !== false && (
                  <div className="flex justify-between text-blue-800 font-semibold">
                    <span>Customer:</span>
                    <span>{sale.customerName}</span>
                  </div>
                )}
              </div>

              {/* 3. Column Headers */}
              <div className="border-t border-dashed border-slate-400 py-1 flex justify-between text-[10px] font-bold text-slate-600 uppercase">
                <span>Description</span>
                <div className="flex items-center gap-4">
                  <span>Qty</span>
                  <span>Total</span>
                </div>
              </div>

              {/* 4. Line Items */}
              <div className="border-t border-slate-200 py-2 space-y-2">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-slate-800 flex-1 min-w-0">
                        {translateProductName(item.productId, item.productName)}
                      </span>
                      <div className="flex items-center gap-4 shrink-0 font-mono">
                        <span className="text-slate-500">{item.quantity}x</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                    {item.variantName && (
                      <p className="text-[10px] text-slate-500 italic pl-1">
                        + {item.variantName}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* 5. Financial Subtotals & Tax Breakdown */}
              <div className="border-t border-dashed border-slate-400 py-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
                </div>
                {sale.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatCurrency(sale.discountAmount)}</span>
                  </div>
                )}

                {/* Tax Breakdown Toggle Section */}
                {fieldToggles.showTaxBreakdown ? (
                  <div className="space-y-0.5 bg-slate-50 p-1.5 rounded border border-slate-200">
                    <div className="flex justify-between text-slate-700 font-medium">
                      <span>Tax ({(sale.taxRate * 100).toFixed(1)}%):</span>
                      <span className="font-mono">{formatCurrency(sale.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Net Taxable Base:</span>
                      <span className="font-mono">{formatCurrency(sale.subtotal - sale.discountAmount)}</span>
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-double border-slate-800 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>TOTAL DUE:</span>
                  <span className="font-mono">{formatCurrency(sale.total)}</span>
                </div>
              </div>

              {/* 6. Payment Methods Breakdown */}
              <div className="border-t border-dashed border-slate-400 py-2 space-y-1 text-[11px]">
                {sale.payments.map((p, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="capitalize font-semibold text-slate-700">
                        {p.method} Payment:
                      </span>
                      <span className="font-mono font-bold">{formatCurrency(p.amount)}</span>
                    </div>
                    {p.tendered !== undefined && (
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Tendered:</span>
                        <span className="font-mono">{formatCurrency(p.tendered)}</span>
                      </div>
                    )}
                    {p.change !== undefined && (
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Change Due:</span>
                        <span className="font-mono">{formatCurrency(p.change)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 7. Loyalty Points Rewards Section Toggle */}
              {fieldToggles.showLoyaltyPoints && (
                <div className="border-t border-dashed border-slate-400 py-2 text-[11px] space-y-1 bg-amber-50/70 p-2 rounded border border-amber-200/60 my-1">
                  <div className="flex justify-between items-center font-bold text-amber-900">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>LOYALTY REWARDS</span>
                    </span>
                    <span className="text-amber-800 font-mono font-black">+{pointsEarned} PTS</span>
                  </div>
                  {customerLoyaltyBalance !== null ? (
                    <div className="flex justify-between text-[10px] text-amber-800">
                      <span>Customer Balance:</span>
                      <span className="font-bold">{customerLoyaltyBalance} pts</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-700 italic">
                      Earn rewards points on every dollar spent
                    </p>
                  )}
                </div>
              )}

              {/* 8. Return Policy Text Section Toggle */}
              {fieldToggles.showReturnPolicy && (
                <div className="border-t border-dashed border-slate-400 py-2 text-[10px] text-slate-600 text-center space-y-0.5">
                  <span className="font-bold text-slate-800 block uppercase tracking-wider text-[9px]">
                    Return & Exchange Policy
                  </span>
                  <p className="leading-tight px-1 text-slate-600">
                    {settings.returnPolicyText || 'Items in original condition may be returned or exchanged within 30 days with receipt.'}
                  </p>
                </div>
              )}

              {/* Notes */}
              {sale.notes && (
                <div className="border-t border-dashed border-slate-400 py-2 text-[10px] text-slate-600">
                  <span className="font-bold block">Notes:</span>
                  <p>{sale.notes}</p>
                </div>
              )}

              {/* 9. Dynamic QR Code Generated from Transaction ID */}
              {fieldToggles.showReceiptQrCode && qrCodeDataUrl && (
                <div className="border-t border-dashed border-slate-400 pt-3 pb-2 text-center flex flex-col items-center">
                  <div
                    onClick={() => setShowDigitalReceiptDialog(true)}
                    className="p-2 bg-white rounded-xl border border-slate-300 shadow-xs cursor-pointer hover:scale-105 transition-all group relative"
                    title="Click to inspect Digital Receipt & Customer Survey"
                  >
                    <img
                      src={qrCodeDataUrl}
                      alt="Digital Receipt & Survey QR Code"
                      className="w-24 h-24 object-contain mx-auto"
                    />
                    <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center">
                      <span className="text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded shadow">
                        Test Scan
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-800 tracking-wide uppercase">
                      {settings.receiptQrType === 'feedback_survey'
                        ? 'Scan for Customer Survey'
                        : settings.receiptQrType === 'digital_receipt'
                        ? 'Scan for Digital Receipt'
                        : 'Scan for Digital Receipt & Survey'}
                    </p>
                    <p className="text-[9px] font-mono text-slate-500">
                      Txn: {transactionId}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDigitalReceiptDialog(true)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer inline-flex items-center gap-1 pt-0.5"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>Test Scan / Open Digital Receipt</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 10. Barcode Simulation */}
              {settings.showBarcode !== false && (
                <div className="border-t border-dashed border-slate-400 pt-2 text-center space-y-1">
                  <div className="flex flex-col items-center justify-center my-1">
                    <div className="h-7 w-40 bg-slate-900 flex items-center justify-center text-white tracking-widest text-[8px] font-mono select-none">
                      || | |||| | ||| || ||| | ||||
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-0.5 tracking-wider">
                      *{sale.receiptNumber}*
                    </span>
                  </div>
                </div>
              )}

              {/* Footer Note */}
              <div className="border-t border-dashed border-slate-400 pt-2 text-center space-y-1">
                <p className="text-[11px] text-slate-600 font-medium">
                  {settings.receiptFooter || 'Thank you for your business! Please come again.'}
                </p>

                <p className="text-[9px] text-slate-400 tracking-wider">
                  — PREVIEW RECEIPT LAYOUT —
                </p>
              </div>
            </div>
          ) : (
            /* ESC/POS Raw Monospace Text View */
            <div className="w-full max-w-lg bg-slate-900 text-emerald-400 p-5 rounded-2xl border border-slate-800 font-mono text-xs overflow-x-auto shadow-2xl select-text">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400">
                <span>ESC/POS Formatted Output ({paperWidth}mm / {paperWidth === 58 ? 32 : 48} Columns)</span>
                <span className="text-emerald-500 font-bold">READY</span>
              </div>
              <pre className="whitespace-pre font-mono leading-tight">{escposText}</pre>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Hardware Printer Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400 hidden sm:inline">
              Destination:
            </span>
            <select
              value={selectedPrinterId}
              onChange={e => setSelectedPrinterId(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium cursor-pointer"
            >
              {availablePrinters.length > 0 ? (
                availablePrinters.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.connectionType.toUpperCase()} - {p.paperWidth}mm)
                  </option>
                ))
              ) : (
                <option value="">Standard System Receipt</option>
              )}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download text file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.txt)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Trigger printer command"
            >
              <PrinterIcon className={`w-3.5 h-3.5 ${isPrinting ? 'animate-spin' : ''}`} />
              <span>{isPrinting ? 'Sending to Printer...' : 'Print Receipt'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Interactive Digital Receipt & Customer Feedback Overlay Dialog */}
        {showDigitalReceiptDialog && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Customer Scan: Digital Receipt & Survey
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Txn: {transactionId}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDigitalReceiptDialog(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Digital Receipt Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {settings.name || 'AURA POS'}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Receipt #{sale.receiptNumber}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Paid • Verified
                  </span>
                </div>

                <div className="space-y-1 text-xs border-t border-slate-200 dark:border-slate-700/60 pt-2">
                  {sale.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="text-slate-700 dark:text-slate-300">
                        {it.quantity}x {translateProductName(it.productId, it.productName)}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(it.unitPrice * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {formatCurrency(sale.total)}
                  </span>
                </div>
              </div>

              {/* Interactive Customer Feedback Survey */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Customer Satisfaction & Feedback Survey</span>
                </div>

                {!feedbackSubmitted ? (
                  <div className="space-y-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {/* Star Rating Selection */}
                    <div className="flex items-center justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className="p-1 hover:scale-125 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= feedbackRating
                                ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                                : 'text-slate-300 dark:text-slate-700'
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <p className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {feedbackRating === 5
                        ? '🌟 Exceptional Experience!'
                        : feedbackRating === 4
                        ? '👍 Great Visit!'
                        : feedbackRating === 3
                        ? '👌 Satisfactory Service'
                        : 'Needs Improvement'}
                    </p>

                    {/* Quick feedback tags */}
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {[
                        'Fast Service',
                        'Friendly Staff',
                        'Clean Store',
                        'Accurate Order',
                        'Great Value',
                        'Easy Payment'
                      ].map(tag => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setSelectedTags(prev =>
                                isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {tag} {isSelected ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback Comment Box */}
                    <textarea
                      rows={2}
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                      placeholder="Share your thoughts or compliments for our team..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackSubmitted(true);
                        showToast({
                          type: 'success',
                          title: 'Thank You for Your Feedback!',
                          message: 'Your review has been attached to this transaction.'
                        });
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      Submit Customer Feedback
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center space-y-1.5">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <h5 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                      Feedback Recorded!
                    </h5>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Thank you for rating your visit {feedbackRating}/5 stars.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDigitalReceiptDialog(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
