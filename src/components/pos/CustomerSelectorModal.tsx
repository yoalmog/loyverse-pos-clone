import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Customer } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import {
  Users,
  Search,
  UserPlus,
  X,
  Check,
  Award,
  Phone,
  Mail,
  ShoppingBag
} from 'lucide-react';

export const CustomerSelectorModal: React.FC = () => {
  const {
    openCustomerModal,
    setOpenCustomerModal,
    customers,
    activeCustomer,
    setActiveCustomer,
    refreshData,
    showToast,
    settings,
    formatCurrency,
    formatNumber,
    t
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // New Customer Form State
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(
      c =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const handleSelectCustomer = (customer: Customer) => {
    setActiveCustomer(customer);
    setOpenCustomerModal(false);
    showToast({
      type: 'success',
      title: t('customers.customerAttached', 'Customer Attached'),
      message: `${customer.firstName} ${customer.lastName} (${customer.loyaltyPoints} pts)`
    });
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim()) {
      showToast({ type: 'warning', title: t('validation.required', 'Missing details'), message: t('validation.required', 'Name and phone are required.') });
      return;
    }

    const nowIso = new Date().toISOString();
    const newCustomer: Customer = {
      id: `cust_${Date.now()}`,
      storeId: settings.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim(),
      loyaltyPoints: 0,
      lifetimePoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const all = StorageService.getCustomers();
    all.unshift(newCustomer);
    StorageService.saveCustomers(all);
    refreshData();

    setActiveCustomer(newCustomer);
    setIsCreatingNew(false);
    setOpenCustomerModal(false);
    showToast({
      type: 'success',
      title: t('customers.customerCreated', 'Customer Enrolled'),
      message: `${newCustomer.firstName} ${newCustomer.lastName}`
    });

    // Reset inputs
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
  };

  if (!openCustomerModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isCreatingNew ? t('customers.addCustomer', 'Enroll New Customer') : t('customers.title', 'Customer & Loyalty Lookup')}
              </h3>
              <p className="text-xs text-slate-500">
                {isCreatingNew ? t('customers.collectInfo', 'Collect info to accrue points and track orders') : t('customers.searchHint', 'Search by name, phone number, or email')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreatingNew && (
              <button
                onClick={() => setIsCreatingNew(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('customers.addCustomer', 'New Customer')}</span>
              </button>
            )}
            <button
              onClick={() => {
                setOpenCustomerModal(false);
                setIsCreatingNew(false);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isCreatingNew ? (
          /* Create Customer Form */
          <form onSubmit={handleCreateCustomer} className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('customers.firstName', 'First Name')} *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="e.g. Maya"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('customers.lastName', 'Last Name')}</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="e.g. Lin"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('customers.phone', 'Phone Number')} *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. (415) 555-0192"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('customers.email', 'Email Address')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. maya@example.com"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('customers.address', 'Street Address')}</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. 742 Evergreen Terrace, SF"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('customers.notes', 'Preferences / Barista Notes')}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Oat milk, decaf, extra hot..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl"
              >
                {t('common.back', 'Back to Search')}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {t('common.save', 'Save & Attach Customer')}
              </button>
            </div>
          </form>
        ) : (
          /* Search & Customer Cards */
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('customers.searchPlaceholder', 'Search by name, phone or email...')}
                  autoFocus
                  className="w-full bg-white text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm font-semibold text-slate-600">{t('customers.noCustomers', 'No matching customers')}</p>
                  <p className="text-xs mt-1">{t('customers.noResultsSubtitle', 'Check spelling or create a new loyalty member.')}</p>
                </div>
              ) : (
                filteredCustomers.map(customer => {
                  const isSelected = activeCustomer?.id === customer.id;
                  return (
                    <div
                      key={customer.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {customer.firstName} {customer.lastName}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                            <Award className="w-3 h-3 text-blue-600" />
                            {customer.loyaltyPoints} {t('pos.points', 'pts')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </span>
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </span>
                          )}
                          <span className="font-mono text-slate-700 font-medium">
                            {formatCurrency(customer.totalSpent)} {t('customers.totalSpent', 'spent')} ({customer.totalOrders} {t('reports.orders', 'orders')})
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectCustomer(customer)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700'
                        }`}
                      >
                        {isSelected ? t('common.selected', 'Selected') : t('common.select', 'Select')}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
