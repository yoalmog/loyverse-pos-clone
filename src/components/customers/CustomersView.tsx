import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Customer, Sale } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import {
  Users,
  Search,
  UserPlus,
  Award,
  Phone,
  Mail,
  ShoppingBag,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Calendar,
  Gift
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { customers, sales, refreshData, showToast, settings, t } = usePOS();

  const [search, setSearch] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New Customer Form
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      c =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  // Customer purchase history
  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales.filter(s => s.customerId === selectedCustomer.id);
  }, [sales, selectedCustomer]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim()) {
      showToast({ type: 'warning', title: 'Name and phone required' });
      return;
    }

    const nowIso = new Date().toISOString();
    const newCust: Customer = {
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
    all.unshift(newCust);
    StorageService.saveCustomers(all);
    refreshData();
    setIsAddModalOpen(false);
    showToast({ type: 'success', title: 'Customer Created', message: `${newCust.firstName} ${newCust.lastName}` });

    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
  };

  const handleDeleteCustomer = (id: string) => {
    if (confirm('Are you sure you want to remove this customer record?')) {
      const all = StorageService.getCustomers().filter(c => c.id !== id);
      StorageService.saveCustomers(all);
      refreshData();
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      showToast({ type: 'info', title: 'Customer Deleted' });
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Customer Directory & Loyalty</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer profiles, purchase histories, and reward point balances
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, or email..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Customer Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4 text-center">Orders</th>
                  <th className="py-3.5 px-4 text-right">Total Spent</th>
                  <th className="py-3.5 px-4 text-center">Loyalty Balance</th>
                  <th className="py-3.5 px-4">Last Visit</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {t('customers.noCustomersFound', 'No customers found')}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(c => {
                    const lastPurchase = c.lastPurchaseDate
                      ? new Date(c.lastPurchaseDate).toLocaleDateString()
                      : 'Never';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900 text-sm">{c.firstName} {c.lastName}</p>
                          {c.notes && <p className="text-[11px] text-slate-400 truncate max-w-xs">{c.notes}</p>}
                        </td>
                        <td className="py-3.5 px-4 space-y-0.5">
                          <p className="font-medium text-slate-800">{c.phone}</p>
                          {c.email && <p className="text-[11px] text-slate-400">{c.email}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                          {c.totalOrders}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ${c.totalSpent.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                            <Award className="w-3.5 h-3.5" />
                            {c.loyaltyPoints} pts
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{lastPurchase}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedCustomer(c)}
                              className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 font-semibold rounded-lg transition-colors"
                            >
                              Profile
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(c.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                              title="Delete customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span>{selectedCustomer.phone}</span>
                  {selectedCustomer.email && <span>· {selectedCustomer.email}</span>}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Quick Stat Cards */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase font-bold">Total Spent</span>
                  <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    ${selectedCustomer.totalSpent.toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase font-bold">Total Orders</span>
                  <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {selectedCustomer.totalOrders}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase font-bold">Avg Basket</span>
                  <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    $
                    {selectedCustomer.totalOrders > 0
                      ? (selectedCustomer.totalSpent / selectedCustomer.totalOrders).toFixed(2)
                      : '0.00'}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <span className="text-[11px] text-blue-700 uppercase font-bold">Points Balance</span>
                  <p className="text-lg font-bold font-mono text-blue-800 mt-0.5">
                    {selectedCustomer.loyaltyPoints}
                  </p>
                </div>
              </div>

              {/* Order History */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Transaction History ({customerSales.length})
                </h4>
                {customerSales.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No orders on record.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                    {customerSales.map(sale => (
                      <div key={sale.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{sale.receiptNumber}</span>
                          <span className="text-slate-400 ml-2">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900">${sale.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Enroll New Customer</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Preferences</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
