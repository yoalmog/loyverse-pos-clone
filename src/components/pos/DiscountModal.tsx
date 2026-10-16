import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Discount } from '../../types/pos.ts';
import { Tag, X, Check, Percent, DollarSign } from 'lucide-react';

export const DiscountModal: React.FC = () => {
  const {
    openDiscountModal,
    setOpenDiscountModal,
    discounts,
    activeDiscount,
    setActiveDiscount,
    subtotal,
    showToast,
    formatCurrency,
    formatNumber,
    t
  } = usePOS();

  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');
  const [customType, setCustomType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [customValue, setCustomValue] = useState<string>('');

  if (!openDiscountModal) return null;

  const handleSelectPreset = (discount: Discount) => {
    if (discount.minimumPurchase && subtotal < discount.minimumPurchase) {
      showToast({
        type: 'warning',
        title: t('validation.invalidPrice', 'Minimum purchase requirement'),
        message: `${t('discounts.minPurchase', 'Requires minimum subtotal of')} ${formatCurrency(discount.minimumPurchase)}.`
      });
      return;
    }
    setActiveDiscount(discount);
    setOpenDiscountModal(false);
    showToast({
      type: 'success',
      title: t('discounts.applied', 'Discount Applied'),
      message: `${discount.name}`
    });
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(customValue);
    if (isNaN(num) || num <= 0) {
      showToast({ type: 'warning', title: t('validation.invalidPrice', 'Invalid value'), message: t('validation.invalidPrice', 'Enter a valid discount amount.') });
      return;
    }

    if (customType === 'percentage' && num > 100) {
      showToast({ type: 'warning', title: t('validation.invalidPrice', 'Limit exceeded'), message: t('validation.invalidPrice', 'Percentage cannot exceed 100%.') });
      return;
    }

    const customDiscount: Discount = {
      id: `disc_custom_${Date.now()}`,
      storeId: 'store_aura_main',
      name: `Custom ${customType === 'percentage' ? `${num}%` : `${formatCurrency(num)}`} Off`,
      type: customType,
      value: num,
      minimumPurchase: 0,
      active: true
    };

    setActiveDiscount(customDiscount);
    setOpenDiscountModal(false);
    showToast({
      type: 'success',
      title: t('discounts.applied', 'Custom Discount Applied'),
      message: `${customDiscount.name}`
    });
  };

  const handleRemoveDiscount = () => {
    setActiveDiscount(null);
    setOpenDiscountModal(false);
    showToast({ type: 'info', title: t('discounts.removed', 'Discount Removed') });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t('discounts.applyDiscount', 'Apply Order Discount')}</h3>
              <p className="text-xs text-slate-500">{t('pos.subtotal', 'Subtotal')}: {formatCurrency(subtotal)}</p>
            </div>
          </div>
          <button
            onClick={() => setOpenDiscountModal(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1">
          <button
            onClick={() => setActiveTab('preset')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'preset'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('nav.discounts', 'Store Promotions')} ({discounts.filter(d => d.active).length})
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'custom'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('discounts.customDiscount', 'Custom Amount / %')}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {activeTab === 'preset' ? (
            <div className="space-y-2">
              {discounts
                .filter(d => d.active)
                .map(d => {
                  const isSelected = activeDiscount?.id === d.id;
                  const isUnderMin = Boolean(d.minimumPurchase && subtotal < d.minimumPurchase);

                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={isUnderMin}
                      onClick={() => handleSelectPreset(d)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 font-semibold'
                          : isUnderMin
                          ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{d.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {d.minimumPurchase > 0 ? `${t('discounts.minPurchase', 'Min purchase')} ${formatCurrency(d.minimumPurchase)}` : t('discounts.noMin', 'No minimum')}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {d.type === 'percentage' ? `${d.value}% OFF` : `${formatCurrency(d.value)} OFF`}
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <form onSubmit={handleApplyCustom} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCustomType('percentage')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                    customType === 'percentage'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>{t('discounts.percentage', 'Percentage (%)')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomType('fixed_amount')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                    customType === 'fixed_amount'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>{t('discounts.fixedAmount', 'Fixed Amount')}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('discounts.discountValue', 'Discount Value')} ({customType === 'percentage' ? '%' : '$'})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  placeholder={customType === 'percentage' ? '15' : '5.00'}
                  className="w-full text-base font-mono font-bold p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                {[5, 10, 15, 20].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCustomValue(val.toString())}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-mono font-semibold rounded-lg text-slate-700"
                  >
                    {customType === 'percentage' ? `${val}%` : formatCurrency(val)}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {t('discounts.applyDiscount', 'Apply Custom Discount')}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          {activeDiscount ? (
            <button
              onClick={handleRemoveDiscount}
              className="text-xs font-medium text-rose-600 hover:text-rose-700"
            >
              {t('discounts.removeDiscount', 'Remove Active Discount')}
            </button>
          ) : (
            <span />
          )}

          <button
            onClick={() => setOpenDiscountModal(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
