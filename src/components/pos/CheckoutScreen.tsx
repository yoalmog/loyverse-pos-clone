import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { PosService } from '../../services/posService.ts';
import { PaymentService } from '../../services/paymentService.ts';
import { LoyaltyService } from '../../services/loyaltyService.ts';
import { Currency } from '../../utils/currency.ts';
import { ReceiptModal } from './ReceiptModal.tsx';
import { PreviewReceiptModal } from './PreviewReceiptModal.tsx';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Award,
  CheckCircle2,
  AlertCircle,
  Delete,
  ShieldCheck,
  Check,
  Eye,
  Receipt,
  QrCode
} from 'lucide-react';
import { PaymentMethod, PaymentRecord, Sale } from '../../types/pos.ts';

export const CheckoutScreen: React.FC = () => {
  const {
    cartItems,
    activeCustomer,
    activeDiscount,
    subtotal,
    discountAmount,
    taxAmount,
    taxRate,
    grandTotal,
    formatCurrency,
    currentEmployee,
    cartNotes,
    clearCart,
    setActiveRoute,
    refreshData,
    showToast,
    settings,
    t,
    translateProductName
  } = usePOS();

  // Payment states
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [tenderedInput, setTenderedInput] = useState<string>(grandTotal.toFixed(2));
  const [isProcessingCard, setIsProcessingCard] = useState<boolean>(false);
  const [cardStatusText, setCardStatusText] = useState<string>('Ready for Tap, Chip, or Swipe');
  const [activeCompletedSale, setActiveCompletedSale] = useState<Sale | null>(null);
  const [isPreviewReceiptOpen, setIsPreviewReceiptOpen] = useState<boolean>(false);
  const [checkoutTxnId] = useState<string>(() => `TXN-${Date.now().toString().slice(-6)}`);

  // Sync tendered amount when grandTotal changes
  useEffect(() => {
    setTenderedInput(grandTotal.toFixed(2));
  }, [grandTotal]);

  // Robust cash change calculation via PaymentService avoiding float errors
  const cashChange = useMemo(() => {
    return PaymentService.calculateCashChange(tenderedInput, grandTotal);
  }, [tenderedInput, grandTotal]);

  const tenderedAmount = cashChange.tenderedDollars;
  const changeDue = cashChange.changeDueDollars;
  const isCashInsufficient = cashChange.isInsufficient;

  // Dynamic quick tender options
  const quickTenderAmounts = useMemo(() => {
    return PaymentService.getQuickTenderAmounts(grandTotal);
  }, [grandTotal]);

  // Memoized draft sale representing current checkout state for receipt preview
  const draftReceiptSale = useMemo<Sale>(() => {
    const draftId = checkoutTxnId;
    const nowIso = new Date().toISOString();
    return {
      id: draftId,
      receiptNumber: `${settings.receiptPrefix || ''}${settings.nextReceiptNumber || 1001}`,
      items: cartItems.map((item, idx) => ({
        id: `item_${idx}_${Date.now()}`,
        saleId: draftId,
        productId: item.productId,
        productName: item.productName,
        variantId: item.variantId,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: 0,
        lineTotal: Currency.multiply(item.unitPrice, item.quantity),
        discountAmount: 0,
        taxAmount: Currency.multiply(Currency.multiply(item.unitPrice, item.quantity), taxRate)
      })),
      subtotal,
      discountAmount,
      taxRate,
      taxAmount,
      total: grandTotal,
      payments: [
        {
          id: `pay_draft`,
          method: selectedMethod,
          amount: grandTotal,
          tendered: selectedMethod === 'cash' ? tenderedAmount : undefined,
          change: selectedMethod === 'cash' ? changeDue : undefined,
          status: 'completed',
          createdAt: nowIso
        }
      ],
      customerId: activeCustomer?.id,
      customerName: activeCustomer ? `${activeCustomer.firstName} ${activeCustomer.lastName}` : undefined,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      storeId: 'store_aura_main',
      notes: cartNotes,
      status: 'completed',
      createdAt: nowIso,
      updatedAt: nowIso,
      isOffline: false
    };
  }, [
    cartItems,
    subtotal,
    discountAmount,
    taxRate,
    taxAmount,
    grandTotal,
    selectedMethod,
    tenderedAmount,
    changeDue,
    activeCustomer,
    currentEmployee,
    cartNotes,
    settings
  ]);

  // Touch keypad handlers for cash
  const handleKeypadPress = (val: string) => {
    if (val === '.') {
      if (!tenderedInput.includes('.')) {
        setTenderedInput(prev => prev + '.');
      }
    } else {
      // If previous was exact default, replace on first keystroke
      if (tenderedInput === grandTotal.toFixed(2)) {
        setTenderedInput(val);
      } else {
        // Prevent more than 2 decimal places
        if (tenderedInput.includes('.')) {
          const parts = tenderedInput.split('.');
          if (parts[1].length >= 2) return;
        }
        setTenderedInput(prev => prev + val);
      }
    }
  };

  const handleKeypadClear = () => {
    setTenderedInput('0');
  };

  const handleKeypadBackspace = () => {
    setTenderedInput(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleQuickTender = (amount: number) => {
    setTenderedInput(amount.toFixed(2));
  };

  // Complete Payment Action
  const handleCompletePayment = (payments: PaymentRecord[]) => {
    try {
      const result = PosService.processSale({
        items: cartItems,
        customer: activeCustomer,
        discount: activeDiscount,
        payments,
        employee: currentEmployee,
        notes: cartNotes
      });

      refreshData();
      setActiveCompletedSale(result.sale);

      if (result.offline) {
        showToast({
          type: 'warning',
          title: 'Offline Sale Recorded',
          message: 'Saved to local queue. Will sync automatically when connected.'
        });
      } else {
        showToast({
          type: 'success',
          title: 'Payment Successful',
          message: `Receipt #${result.sale.receiptNumber} generated.`
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Checkout Error',
        message: err?.message || 'Could not complete transaction.'
      });
    }
  };

  // Cash Checkout Handler
  const handleCompleteCash = () => {
    if (isCashInsufficient) {
      showToast({ type: 'warning', title: 'Insufficient cash amount', message: 'Tendered amount must cover grand total.' });
      return;
    }

    const cashPayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: 'cash',
      amount: grandTotal,
      tendered: tenderedAmount,
      change: changeDue,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    handleCompletePayment([cashPayment]);
  };

  // Card Payment Handler (Terminal / External Card Entry)
  const handleStartCardPayment = () => {
    const cardPayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: 'card',
      amount: grandTotal,
      transactionReference: `CARD-${Date.now().toString().slice(-6)}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    handleCompletePayment([cardPayment]);
  };

  // Contactless Mobile Payment Handler (Apple Pay / Google Pay / NFC)
  const handleCompleteMobile = () => {
    const mobilePayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: 'mobile',
      amount: grandTotal,
      transactionReference: `NFC-${Date.now().toString().slice(-6)}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    handleCompletePayment([mobilePayment]);
  };

  // Bank Transfer
  const handleCompleteBank = () => {
    const bankPayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: 'bank',
      amount: grandTotal,
      transactionReference: `BANK-${Date.now().toString().slice(-6)}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    handleCompletePayment([bankPayment]);
  };

  // Loyalty Points Redemption
  const loyaltyStatus = useMemo(() => {
    return LoyaltyService.canRedeem(activeCustomer, grandTotal, settings.redemptionRate || 0.05);
  }, [activeCustomer, grandTotal, settings.redemptionRate]);

  const pointsNeeded = loyaltyStatus.pointsNeeded;
  const canUseLoyalty = loyaltyStatus.canRedeem;

  const handleCompleteLoyalty = () => {
    if (!canUseLoyalty) {
      showToast({
        type: 'warning',
        title: 'Not enough points',
        message: `Requires ${pointsNeeded} points. Customer has ${activeCustomer?.loyaltyPoints || 0}.`
      });
      return;
    }

    const loyaltyPayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      method: 'loyalty',
      amount: grandTotal,
      transactionReference: `PTS-REDEEM-${pointsNeeded}`,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    // Deduct points
    if (activeCustomer) {
      LoyaltyService.deductPoints(activeCustomer, pointsNeeded);
    }

    handleCompletePayment([loyaltyPayment]);
  };

  const handleStartNewSale = () => {
    clearCart();
    setActiveCompletedSale(null);
    setTenderedInput('0.00');
    setActiveRoute('pos');
  };

  return (
    <div className="flex-1 theme-app-bg flex flex-col overflow-y-auto">
      {/* Top back bar */}
      <div className="theme-surface border-b border-[var(--theme-border)] px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => setActiveRoute('pos')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('checkout.back', 'Back to Register')}</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">
            {t('header.cashier', 'Cashier')}: <strong className="text-slate-800">{currentEmployee.name}</strong>
          </span>
          {activeCustomer && (
            <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 font-semibold">
              {t('pos.customer', 'Customer')}: {activeCustomer.firstName} {activeCustomer.lastName}
            </span>
          )}
        </div>
      </div>

      {/* Main Split Screen */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Order Summary (5 cols) */}
        <div className="lg:col-span-5 theme-card rounded-2xl border border-[var(--theme-card-border)] p-6 shadow-xs flex flex-col justify-between h-fit">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--theme-divider)] gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {t('checkout.orderSummary', 'Order Summary')}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewReceiptOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                  title="Preview receipt formatting, QR code, and fields"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Receipt</span>
                  <QrCode className="w-3 h-3 text-blue-500 opacity-80" />
                </button>
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  #{settings.receiptPrefix}{settings.nextReceiptNumber}
                </span>
              </div>
            </div>

            {/* Line items list with product images */}
            <div className="py-4 space-y-3 max-h-72 overflow-y-auto pr-1">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.imageUrl ? (
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{
                          backgroundColor: item.color ? `${item.color}15` : '#EFF6FF',
                          color: item.color || '#2563EB'
                        }}
                      >
                        {item.productName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {item.quantity}x {translateProductName(item.productId, item.productName)}
                      </p>
                      {item.variantName && (
                        <p className="text-[11px] text-blue-600">{item.variantName}</p>
                      )}
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatCurrency(item.unitPrice)} {t('pos.each', 'each')}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    {formatCurrency(Currency.multiply(item.unitPrice, item.quantity))}
                  </span>
                </div>
              ))}
            </div>

            {/* Notes if present */}
            {cartNotes && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 mb-3">
                <span className="font-semibold text-slate-700 block">{t('pos.notes', 'Notes')}:</span>
                {cartNotes}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{t('pos.subtotal', 'Subtotal')}</span>
              <span className="font-mono tabular-nums font-semibold">{formatCurrency(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>{t('pos.discount', 'Discount')} ({activeDiscount?.name || 'Promo'})</span>
                <span className="font-mono tabular-nums">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>{t('pos.tax', 'Tax')} ({(taxRate * 100).toFixed(2)}%)</span>
              <span className="font-mono tabular-nums font-semibold">{formatCurrency(taxAmount)}</span>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-base font-bold text-slate-900">{t('pos.total', 'Total Due')}</span>
              <span className="text-3xl font-black font-mono text-slate-900 tabular-nums">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsPreviewReceiptOpen(true)}
              className="w-full mt-3 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>Preview Formatted Receipt</span>
            </button>
          </div>
        </div>

        {/* Right Column: Payment Methods & Cash Keypad (7 cols) */}
        <div className="lg:col-span-7 theme-card rounded-2xl border border-[var(--theme-card-border)] p-6 shadow-xs flex flex-col">
          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-5 gap-2 mb-6">
            {[
              { id: 'cash', label: t('checkout.cash', 'Cash'), icon: Banknote },
              { id: 'card', label: t('checkout.card', 'Card'), icon: CreditCard },
              { id: 'mobile', label: t('checkout.mobile', 'Mobile'), icon: Smartphone },
              { id: 'bank', label: t('checkout.bank', 'Bank'), icon: Building2 },
              { id: 'loyalty', label: t('checkout.loyalty', 'Loyalty Pts'), icon: Award }
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = selectedMethod === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedMethod(tab.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-variant)] text-[var(--theme-text-primary)] font-bold ring-2 ring-[var(--theme-primary)] shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-[var(--theme-primary)]' : 'text-slate-500'}`} />
                  <span className="text-[11px] leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* CASH PAYMENT PANEL */}
          {selectedMethod === 'cash' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">
                    {t('checkout.amountTendered', 'Amount Received')}
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-2xl font-mono font-bold text-slate-500">$</span>
                    <input
                      type="text"
                      readOnly
                      value={tenderedInput}
                      className="text-3xl font-mono font-black text-slate-900 bg-transparent focus:outline-none w-48 tabular-nums"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">
                    {t('checkout.changeDue', 'Change Due')}
                  </span>
                  <p
                    className={`text-2xl font-mono font-black tabular-nums mt-1 ${
                      isCashInsufficient ? 'text-slate-400' : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(changeDue)}
                  </p>
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickTender(grandTotal)}
                  className="py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-colors cursor-pointer"
                >
                  {t('checkout.exact', 'Exact')} ({formatCurrency(grandTotal)})
                </button>
                {quickTenderAmounts.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickTender(amt)}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold font-mono text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>

              {/* Touch Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-12 bg-white hover:bg-slate-50 active:bg-blue-50 text-slate-900 text-lg font-bold rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center justify-center"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-12 bg-white hover:bg-slate-50 active:bg-blue-50 text-slate-900 text-lg font-bold rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center justify-center"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors flex items-center justify-center"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {/* Complete Cash Button */}
              <button
                type="button"
                disabled={isCashInsufficient}
                onClick={handleCompleteCash}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all mt-2 cursor-pointer"
              >
                {t('checkout.completeCashBtn', 'COMPLETE CASH PAYMENT')} · {t('checkout.change', 'CHANGE')} {formatCurrency(changeDue)}
              </button>
            </div>
          )}

          {/* CARD PAYMENT PANEL */}
          {selectedMethod === 'card' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <CreditCard className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">{t('checkout.cardTerminal', 'Card Payment Terminal')}</h4>
                <p className="text-sm text-slate-500 mt-1">{t('checkout.amountToCharge', 'Amount to charge')}: {formatCurrency(grandTotal)}</p>
                <p className="text-xs font-mono font-semibold text-blue-600 mt-2 bg-blue-50 py-1.5 px-3 rounded-full inline-block">
                  {cardStatusText}
                </p>
              </div>

              <div className="w-full max-w-sm space-y-3">
                <button
                  type="button"
                  disabled={isProcessingCard}
                  onClick={handleStartCardPayment}
                  className="w-full py-3.5 active:scale-[0.99] font-bold text-sm rounded-xl shadow-md disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: 'var(--theme-button)', color: 'var(--theme-button-text)' }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isProcessingCard ? t('checkout.processing', 'Processing...') : t('checkout.processCardPayment', 'Process Terminal Transaction')}</span>
                </button>

                <p className="text-[11px] text-slate-400">
                  Ready for EMV chip card readers, Stripe Terminal, or Square Reader hardware adapter.
                </p>
              </div>
            </div>
          )}

          {/* MOBILE PAYMENT (Apple Pay / Google Pay) */}
          {selectedMethod === 'mobile' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <Smartphone className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">{t('checkout.mobileTitle', 'Contactless Mobile Payment')}</h4>
                <p className="text-sm text-slate-500 mt-1">Apple Pay · Google Wallet · Samsung Pay</p>
                <p className="text-2xl font-black font-mono text-slate-900 mt-2">
                  {formatCurrency(grandTotal)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCompleteMobile}
                className="w-full max-w-sm py-3.5 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                {t('checkout.tapPhone', 'Tap Customer Phone to Reader')}
              </button>
            </div>
          )}

          {/* BANK TRANSFER PANEL */}
          {selectedMethod === 'bank' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Building2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">{t('checkout.bankTitle', 'Direct Bank / Wire Transfer')}</h4>
                <p className="text-sm text-slate-500 mt-1">Invoice / Corporate Wholesale Payment</p>
                <p className="text-2xl font-black font-mono text-slate-900 mt-2">
                  {formatCurrency(grandTotal)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCompleteBank}
                className="w-full max-w-sm py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                {t('checkout.confirmWire', 'Confirm Wire / Bank Reference')}
              </button>
            </div>
          )}

          {/* LOYALTY POINTS REDEMPTION PANEL */}
          {selectedMethod === 'loyalty' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">{t('checkout.loyaltyTitle', 'Redeem Loyalty Points')}</h4>
                {activeCustomer ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {activeCustomer.firstName} {activeCustomer.lastName}
                    </p>
                    <p className="text-xs text-blue-600 font-bold">
                      Available Balance: {activeCustomer.loyaltyPoints} points
                    </p>
                    <p className="text-xs text-slate-500">
                      Points required for this order: <strong>{pointsNeeded} points</strong> ($
                      {settings.redemptionRate} / point)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-600 font-medium mt-2">
                    No customer attached. Please return to cart and attach a loyalty member first.
                  </p>
                )}
              </div>

              {canUseLoyalty ? (
                <button
                  type="button"
                  onClick={handleCompleteLoyalty}
                  className="w-full max-w-sm py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-md transition-all"
                >
                  {t('checkout.redeemPointsBtn', 'Redeem Points & Complete Sale')}
                </button>
              ) : (
                <p className="text-xs text-slate-400">
                  {activeCustomer
                    ? `Customer needs ${pointsNeeded - activeCustomer.loyaltyPoints} more points to pay with rewards.`
                    : 'Customer required.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Completed Sale Receipt Modal */}
      {activeCompletedSale && (
        <ReceiptModal
          sale={activeCompletedSale}
          isOpen={!!activeCompletedSale}
          onClose={() => {
            clearCart();
            setActiveCompletedSale(null);
            setTenderedInput('0.00');
            setActiveRoute('pos');
          }}
          onNewSale={handleStartNewSale}
        />
      )}

      {/* Pre-Payment / Pre-Print Receipt Preview Modal */}
      <PreviewReceiptModal
        isOpen={isPreviewReceiptOpen}
        onClose={() => setIsPreviewReceiptOpen(false)}
        sale={draftReceiptSale}
      />
    </div>
  );
};
