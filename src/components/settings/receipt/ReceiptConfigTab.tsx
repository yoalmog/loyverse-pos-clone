import React, { useState, useEffect } from 'react';
import { StoreSettings, Sale } from '../../../types/pos.ts';
import { usePOS } from '../../../context/POSContext.tsx';
import QRCode from 'qrcode';
import {
  Receipt,
  QrCode,
  Award,
  Percent,
  Image as ImageIcon,
  FileText,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Eye,
  Sliders,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Check,
  Building,
  Upload,
  AlertCircle
} from 'lucide-react';
import { PreviewReceiptModal } from '../../pos/PreviewReceiptModal.tsx';

interface ReceiptConfigTabProps {
  formData: StoreSettings;
  onChange: (field: keyof StoreSettings, val: any) => void;
  onSave?: (e: React.FormEvent) => void;
}

export const ReceiptConfigTab: React.FC<ReceiptConfigTabProps> = ({
  formData,
  onChange,
  onSave
}) => {
  const { showToast, formatCurrency, t } = usePOS();
  const [activeSubSection, setActiveSubSection] = useState<'fields' | 'policy' | 'qrcode' | 'header_footer'>('fields');
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');
  const [isTestPreviewOpen, setIsTestPreviewOpen] = useState<boolean>(false);

  // Generate a live QR code preview for the settings screen
  useEffect(() => {
    const dummyTxnId = `TXN-${formData.nextReceiptNumber || 1001}-${Date.now().toString().slice(-4)}`;
    let targetUrl = `${window.location.origin}/receipt?txn=${encodeURIComponent(dummyTxnId)}`;
    if (formData.receiptQrType === 'feedback_survey') {
      targetUrl = `${formData.feedbackSurveyUrl || 'https://aurapos.app/feedback'}?txn=${encodeURIComponent(dummyTxnId)}`;
    } else if (formData.receiptQrType === 'both') {
      targetUrl = `${window.location.origin}/receipt?txn=${encodeURIComponent(dummyTxnId)}&feedback=1`;
    }

    QRCode.toDataURL(targetUrl, {
      margin: 1,
      width: 140,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrPreviewUrl(url))
      .catch(err => console.error('Error generating preview QR:', err));
  }, [formData.receiptQrType, formData.feedbackSurveyUrl, formData.nextReceiptNumber]);

  // Sample sale object to test preview modal
  const sampleSale: Sale = {
    id: `sample_sale_${formData.nextReceiptNumber || 1001}`,
    receiptNumber: `${formData.receiptPrefix || 'REC-'}${formData.nextReceiptNumber || 1001}`,
    items: [
      {
        id: 'sample_item_1',
        saleId: 'sample_sale',
        productId: 'prod_1',
        productName: 'Signature Espresso Blend',
        variantName: 'Medium Roast (12oz)',
        quantity: 2,
        unitPrice: 14.5,
        lineTotal: 29.0,
        discountAmount: 0,
        taxAmount: 2.32
      },
      {
        id: 'sample_item_2',
        saleId: 'sample_sale',
        productId: 'prod_2',
        productName: 'Artisan Butter Croissant',
        quantity: 1,
        unitPrice: 4.75,
        lineTotal: 4.75,
        discountAmount: 0,
        taxAmount: 0.38
      }
    ],
    subtotal: 33.75,
    discountAmount: 3.0,
    taxRate: 0.08,
    taxAmount: 2.46,
    total: 33.21,
    payments: [
      {
        id: 'sample_pay_1',
        method: 'card',
        amount: 33.21,
        status: 'completed',
        createdAt: new Date().toISOString()
      }
    ],
    customerId: 'cust_sample_1',
    customerName: 'Alex Morgan',
    employeeId: 'emp_1',
    employeeName: 'Sarah Jenkins',
    storeId: formData.id,
    notes: 'Sample receipt layout preview',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isOffline: false
  };

  const RETURN_POLICY_PRESETS = [
    {
      title: '30-Day Standard',
      text: 'Items in original condition may be returned or exchanged within 30 days with receipt.'
    },
    {
      title: '14-Day Store Credit',
      text: 'Returns accepted within 14 days for store credit or exchange only. Original tags must be attached.'
    },
    {
      title: 'Exchange Only',
      text: 'All sales final on discounted merchandise. Regular items eligible for exchange within 7 days.'
    },
    {
      title: 'No Return / Final Sale',
      text: 'All sales are final. Defective merchandise may be serviced or replaced within 48 hours of purchase.'
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-Menu Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Receipt Configuration
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Thermal & Digital
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize print and preview layouts: toggle Tax Breakdown, Loyalty Rewards, Store Logo, Return Policy, and Dynamic QR Codes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsTestPreviewOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer self-start md:self-auto active:scale-95"
        >
          <Eye className="w-4 h-4" />
          <span>Launch Receipt Preview</span>
        </button>
      </div>

      {/* Sub-Menu Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveSubSection('fields')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === 'fields'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Receipt Fields Toggles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('policy')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === 'policy'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Return Policy Text</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('qrcode')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === 'qrcode'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Dynamic QR Code (Digital & Survey)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubSection('header_footer')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubSection === 'header_footer'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Header, Footer & Numbering</span>
        </button>
      </div>

      {/* Main Grid: Settings Controls (Left 7 Cols) + Live Visual Layout Preview (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Core Field Toggles */}
          {activeSubSection === 'fields' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Field Visibility & Layout Toggles</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enable or hide specific sections on printed tickets and pre-print modal previews.
                </p>
              </div>

              <div className="space-y-3.5">
                {/* 1. Store Logo */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Store Logo
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Prints store brand insignia at the top of the receipt. If disabled, only text business name will be shown.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={formData.showStoreLogo !== false}
                      onChange={e => onChange('showStoreLogo', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* 2. Tax Breakdown */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Tax Breakdown
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Shows itemized sales tax percentage rate, taxable net total, and total tax amount.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={formData.showTaxBreakdown !== false}
                      onChange={e => onChange('showTaxBreakdown', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* 3. Loyalty Points */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Loyalty Points
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Prints points earned on the current order and remaining customer reward points balance.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={formData.showLoyaltyPoints !== false}
                      onChange={e => onChange('showLoyaltyPoints', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* 4. Return Policy Text */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Return Policy Text
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Displays return and exchange terms in the footer section of the receipt.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={formData.showReturnPolicy !== false}
                      onChange={e => onChange('showReturnPolicy', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* 5. Dynamic QR Code */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Dynamic QR Code
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Generates a scannable 2D QR code from the transaction ID for digital receipts or customer feedback surveys.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={formData.showReceiptQrCode !== false}
                      onChange={e => onChange('showReceiptQrCode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Additional Toggles (Cashier, Customer, Barcode) */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.showCashier}
                      onChange={e => onChange('showCashier', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Cashier Name
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.showCustomer}
                      onChange={e => onChange('showCustomer', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Customer Name
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.showBarcode}
                      onChange={e => onChange('showBarcode', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Linear Barcode
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Return Policy Customization */}
          {activeSubSection === 'policy' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                    <span>Return Policy Configuration</span>
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-600">
                    <input
                      type="checkbox"
                      checked={formData.showReturnPolicy !== false}
                      onChange={e => onChange('showReturnPolicy', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>Enabled on Receipt</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set customer-facing return and exchange terms to be printed on receipts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Return Policy Text
                </label>
                <textarea
                  rows={3}
                  value={formData.returnPolicyText || ''}
                  onChange={e => onChange('returnPolicyText', e.target.value)}
                  placeholder="Items in original condition may be returned or exchanged within 30 days with receipt."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Quick Policy Presets
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RETURN_POLICY_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onChange('returnPolicyText', preset.text);
                        onChange('showReturnPolicy', true);
                        showToast({ type: 'info', title: `Applied: ${preset.title}` });
                      }}
                      className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/30 transition-all cursor-pointer group"
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 block">
                        {preset.title}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {preset.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Dynamic QR Code Configuration */}
          {activeSubSection === 'qrcode' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <span>Dynamic QR Code Configuration</span>
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-600">
                    <input
                      type="checkbox"
                      checked={formData.showReceiptQrCode !== false}
                      onChange={e => onChange('showReceiptQrCode', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate dynamic QR codes from the transaction ID so customers can scan for digital copies or feedback.
                </p>
              </div>

              {/* QR Code Purpose Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  QR Code Functionality & Purpose
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'both',
                      title: 'Receipt & Survey',
                      desc: 'Opens Digital Receipt with interactive satisfaction feedback survey.'
                    },
                    {
                      id: 'digital_receipt',
                      title: 'Digital Receipt Only',
                      desc: 'Direct link to paperless digital receipt and transaction archive.'
                    },
                    {
                      id: 'feedback_survey',
                      title: 'Feedback Survey',
                      desc: 'Direct link to customer review and survey with attached order ID.'
                    }
                  ].map(mode => {
                    const isSelected = (formData.receiptQrType || 'both') === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => onChange('receiptQrType', mode.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                            {mode.title}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          {mode.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Survey URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Customer Feedback Survey Portal URL
                </label>
                <input
                  type="url"
                  value={formData.feedbackSurveyUrl || ''}
                  onChange={e => onChange('feedbackSurveyUrl', e.target.value)}
                  placeholder="https://aurapos.app/feedback"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The transaction ID will be passed automatically as a query parameter (e.g. ?txn=TXN-1001).
                </p>
              </div>

              {/* Sample QR preview card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                {qrPreviewUrl ? (
                  <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs shrink-0">
                    <img src={qrPreviewUrl} alt="Preview QR" className="w-20 h-20 object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse shrink-0" />
                )}
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Sample Generated QR Payload
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Target: <span className="font-mono text-blue-600 dark:text-blue-400">
                      {formData.receiptQrType === 'feedback_survey'
                        ? `${formData.feedbackSurveyUrl || 'https://aurapos.app/feedback'}?txn=TXN-${formData.nextReceiptNumber || 1001}`
                        : `${window.location.origin}/receipt?txn=TXN-${formData.nextReceiptNumber || 1001}`}
                    </span>
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    High-contrast ECC Level M (Optimized for 203 DPI thermal printers)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Headers, Footers & Numbering */}
          {activeSubSection === 'header_footer' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Receipt Text & Numbering Sequences</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure greeting lines, sequential transaction numbering, and legal disclaimers.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Receipt Number Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.receiptPrefix}
                    onChange={e => onChange('receiptPrefix', e.target.value)}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Next Sequential #
                  </label>
                  <input
                    type="number"
                    value={formData.nextReceiptNumber}
                    onChange={e => onChange('nextReceiptNumber', parseInt(e.target.value, 10))}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Receipt Header Greeting
                </label>
                <input
                  type="text"
                  value={formData.receiptHeader}
                  onChange={e => onChange('receiptHeader', e.target.value)}
                  placeholder="Welcome to our store!"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Receipt Footer Note
                </label>
                <textarea
                  rows={2}
                  value={formData.receiptFooter}
                  onChange={e => onChange('receiptFooter', e.target.value)}
                  placeholder="Thank you for your business! Please come again."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Interactive Live Preview Card */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-sm sticky top-6 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Live Thermal Layout Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">80mm Paper</span>
            </div>

            {/* Simulated Thermal Ticket */}
            <div className="bg-white text-slate-900 p-5 rounded-sm shadow-xl border-t-8 border-b-8 border-slate-300 font-mono text-[11px] select-text relative transition-all">
              {/* Top Jagged Edge */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-b from-slate-200 to-transparent opacity-60" />

              {/* 1. Store Header & Logo */}
              <div className="text-center space-y-1 mb-3">
                {formData.showStoreLogo !== false && (
                  <div className="flex justify-center mb-1">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Store Logo"
                        className="h-10 w-auto max-w-[140px] object-contain filter grayscale contrast-125"
                      />
                    ) : (
                      <div className="px-3 py-1 rounded bg-slate-900 text-white font-sans text-xs font-black tracking-widest uppercase">
                        {formData.name || 'AURA POS'}
                      </div>
                    )}
                  </div>
                )}
                <h5 className="font-bold font-sans text-sm text-slate-900 leading-tight">
                  {formData.name || 'AURA POS'}
                </h5>
                {formData.address && (
                  <p className="text-[10px] text-slate-500">{formData.address}</p>
                )}
                {formData.phone && (
                  <p className="text-[10px] text-slate-500">Tel: {formData.phone}</p>
                )}
                {formData.receiptHeader && (
                  <p className="text-[10px] text-slate-700 italic pt-0.5">{formData.receiptHeader}</p>
                )}
              </div>

              {/* 2. Order Metadata */}
              <div className="border-t border-dashed border-slate-300 py-1.5 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt #:</span>
                  <span className="font-bold">
                    {formData.receiptPrefix || 'REC-'}{formData.nextReceiptNumber || 1001}
                  </span>
                </div>
                {formData.showCashier && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier:</span>
                    <span>Sarah J.</span>
                  </div>
                )}
                {formData.showCustomer && (
                  <div className="flex justify-between text-blue-800">
                    <span>Customer:</span>
                    <span className="font-bold">Alex Morgan</span>
                  </div>
                )}
              </div>

              {/* 3. Items */}
              <div className="border-t border-dashed border-slate-300 py-1.5 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Item</span>
                  <span>Total</span>
                </div>
                <div className="flex justify-between">
                  <span>2x Espresso Blend</span>
                  <span className="font-bold">$29.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Butter Croissant</span>
                  <span className="font-bold">$4.75</span>
                </div>
              </div>

              {/* 4. Subtotals & Tax Breakdown */}
              <div className="border-t border-dashed border-slate-300 py-1.5 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span>$33.75</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-$3.00</span>
                </div>

                {/* Tax Breakdown Toggle Display */}
                {formData.showTaxBreakdown !== false ? (
                  <div className="space-y-0.5 bg-slate-50 p-1 rounded">
                    <div className="flex justify-between text-slate-600 font-semibold">
                      <span>Tax (8.0%):</span>
                      <span>$2.46</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Taxable Net:</span>
                      <span>$30.75</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] text-slate-400 italic">
                    (Tax breakdown hidden)
                  </div>
                )}

                <div className="border-t border-double border-slate-800 pt-1 flex justify-between font-bold text-xs">
                  <span>TOTAL DUE:</span>
                  <span>$33.21</span>
                </div>
              </div>

              {/* 5. Loyalty Points Section Toggle */}
              {formData.showLoyaltyPoints !== false && (
                <div className="border-t border-dashed border-slate-300 py-1.5 text-[10px] bg-amber-50/60 p-1.5 rounded my-1">
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>★ LOYALTY POINTS</span>
                    <span>+33 PTS</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-amber-800">
                    <span>Current Balance:</span>
                    <span>240 pts</span>
                  </div>
                </div>
              )}

              {/* 6. Return Policy Section Toggle */}
              {formData.showReturnPolicy !== false && (
                <div className="border-t border-dashed border-slate-300 py-1.5 text-center space-y-0.5">
                  <span className="font-bold text-[9px] text-slate-700 uppercase block">
                    Return Policy
                  </span>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    {formData.returnPolicyText || 'Items in original condition may be returned or exchanged within 30 days with receipt.'}
                  </p>
                </div>
              )}

              {/* 7. Dynamic QR Code Section Toggle */}
              {formData.showReceiptQrCode !== false && qrPreviewUrl && (
                <div className="border-t border-dashed border-slate-300 pt-2 pb-1 text-center flex flex-col items-center">
                  <img src={qrPreviewUrl} alt="QR Code" className="w-20 h-20 object-contain" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-700 mt-0.5">
                    {formData.receiptQrType === 'feedback_survey'
                      ? 'Scan for Customer Survey'
                      : formData.receiptQrType === 'digital_receipt'
                      ? 'Scan for Digital Receipt'
                      : 'Scan for Digital Receipt & Survey'}
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono">
                    Txn: TXN-{formData.nextReceiptNumber || 1001}
                  </span>
                </div>
              )}

              {/* 8. Barcode */}
              {formData.showBarcode && (
                <div className="border-t border-dashed border-slate-300 pt-2 text-center">
                  <div className="h-6 w-32 mx-auto bg-slate-900 flex items-center justify-center text-white tracking-widest text-[7px] font-mono select-none">
                    || | |||| | ||| || ||
                  </div>
                </div>
              )}

              {/* Footer Note */}
              <div className="pt-2 text-center text-[9px] text-slate-500">
                <p>{formData.receiptFooter || 'Thank you for your business!'}</p>
                <p className="text-[8px] text-slate-400 mt-0.5">— AURA POS THERMAL —</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Preview Modal for live testing */}
      <PreviewReceiptModal
        isOpen={isTestPreviewOpen}
        onClose={() => setIsTestPreviewOpen(false)}
        sale={sampleSale}
      />
    </div>
  );
};
