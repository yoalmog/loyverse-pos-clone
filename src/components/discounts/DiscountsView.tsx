import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Discount, DiscountType } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import { Tag, Plus, Edit2, Trash2, X, Percent, DollarSign, Check } from 'lucide-react';

export const DiscountsView: React.FC = () => {
  const { discounts, refreshData, showToast, settings, isOwner, requireOwnerAuth, t } = usePOS();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingDisc, setEditingDisc] = useState<Discount | null>(null);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<DiscountType>('percentage');
  const [formValue, setFormValue] = useState<string>('10');
  const [formMinPurchase, setFormMinPurchase] = useState<string>('0');
  const [formCode, setFormCode] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);

  const handleOpenAdd = () => {
    requireOwnerAuth(() => {
      setEditingDisc(null);
      setFormName('');
      setFormType('percentage');
      setFormValue('10');
      setFormMinPurchase('0');
      setFormCode('');
      setFormActive(true);
      setIsModalOpen(true);
    }, t('discounts.addOwnerAuth', 'Create New Discount Promotion'));
  };

  const handleOpenEdit = (d: Discount) => {
    requireOwnerAuth(() => {
      setEditingDisc(d);
      setFormName(d.name);
      setFormType(d.type);
      setFormValue(d.value.toString());
      setFormMinPurchase(d.minimumPurchase.toString());
      setFormCode(d.code || '');
      setFormActive(d.active);
      setIsModalOpen(true);
    }, t('discounts.editOwnerAuth', 'Edit Discount Promotion'));
  };

  const handleSaveDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formValue.trim()) {
      showToast({ type: 'warning', title: 'Missing required fields' });
      return;
    }

    requireOwnerAuth(() => {
      const val = parseFloat(formValue) || 0;
      const min = parseFloat(formMinPurchase) || 0;
      const all = StorageService.getDiscounts();

      if (editingDisc) {
        const idx = all.findIndex(d => d.id === editingDisc.id);
        if (idx !== -1) {
          all[idx] = {
            ...editingDisc,
            name: formName.trim(),
            type: formType,
            value: val,
            minimumPurchase: min,
            code: formCode.trim() || undefined,
            active: formActive
          };
          StorageService.saveDiscounts(all);
          refreshData();
          showToast({ type: 'success', title: 'Discount Updated', message: formName });
        }
      } else {
        const newD: Discount = {
          id: `disc_${Date.now()}`,
          storeId: settings.id,
          name: formName.trim(),
          type: formType,
          value: val,
          minimumPurchase: min,
          code: formCode.trim() || undefined,
          active: formActive
        };
        all.push(newD);
        StorageService.saveDiscounts(all);
        refreshData();
        showToast({ type: 'success', title: 'Discount Created', message: formName });
      }

      setIsModalOpen(false);
    }, 'Save Discount');
  };

  const handleDelete = (id: string) => {
    requireOwnerAuth(() => {
      if (confirm('Delete this discount?')) {
        const all = StorageService.getDiscounts().filter(d => d.id !== id);
        StorageService.saveDiscounts(all);
        refreshData();
        showToast({ type: 'info', title: 'Discount Deleted' });
      }
    }, 'Delete Discount');
  };

  const handleToggleActive = (d: Discount) => {
    requireOwnerAuth(() => {
      const all = StorageService.getDiscounts();
      const idx = all.findIndex(item => item.id === d.id);
      if (idx !== -1) {
        all[idx].active = !all[idx].active;
        StorageService.saveDiscounts(all);
        refreshData();
        showToast({
          type: 'info',
          title: all[idx].active ? 'Promotion Enabled' : 'Promotion Disabled'
        });
      }
    }, 'Toggle Promotion Status');
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Promotions & Discounts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure happy hour specials, VIP rewards, staff courtesy, and coupon codes
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Discount</span>
          </button>
        </div>

        {/* Discounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discounts.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              {t('discounts.noDiscountsFound', 'No discounts configured')}
            </div>
          ) : (
            discounts.map(d => (
            <div
              key={d.id}
              className={`bg-white p-5 rounded-2xl border transition-all ${
                d.active ? 'border-slate-200 shadow-2xs' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {d.type === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{d.name}</h4>
                    {d.code && (
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        CODE: {d.code}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleActive(d)}
                  className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${
                    d.active
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {d.active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="my-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block uppercase font-bold">Benefit</span>
                  <p className="text-2xl font-mono font-black text-blue-600 tabular-nums">
                    {d.type === 'percentage' ? `${d.value}% OFF` : `$${d.value.toFixed(2)} OFF`}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block uppercase font-bold">Minimum Order</span>
                  <p className="text-sm font-mono font-bold text-slate-700">
                    {d.minimumPurchase > 0 ? `$${d.minimumPurchase.toFixed(2)}` : 'None'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(d)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Discount"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete Discount"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingDisc ? 'Edit Promotion' : 'New Promotion / Discount'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Promotion Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon Happy Hour 15%"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('percentage')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    formType === 'percentage'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('fixed_amount')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    formType === 'fixed_amount'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Fixed Dollar ($)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Value ({formType === 'percentage' ? '%' : '$'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formValue}
                    onChange={e => setFormValue(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Order Subtotal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formMinPurchase}
                    onChange={e => setFormMinPurchase(e.target.value)}
                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Promo Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SUMMER26"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="disc_active"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="disc_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (Ready in POS Cart)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
