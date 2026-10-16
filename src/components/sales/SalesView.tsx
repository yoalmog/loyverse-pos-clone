import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Sale, Refund, PaymentMethod } from '../../types/pos.ts';
import { PosService } from '../../services/posService.ts';
import { Currency } from '../../utils/currency.ts';
import { ReceiptModal } from '../pos/ReceiptModal.tsx';
import {
  Receipt,
  Search,
  RotateCcw,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Award
} from 'lucide-react';

export const SalesView: React.FC = () => {
  const {
    sales,
    currentEmployee,
    refreshData,
    showToast,
    isOwner,
    requireOwnerAuth,
    translateProductName,
    formatCurrency,
    formatDate,
    formatTime,
    formatNumber,
    t
  } = usePOS();

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Sale for viewing receipt
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);

  // Refund dialog state
  const [saleForRefund, setSaleForRefund] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState<string>('Customer Changed Mind');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'bank' | 'mobile'>('cash');

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReceipt = s.receiptNumber.toLowerCase().includes(q);
        const matchesCust = s.customerName && s.customerName.toLowerCase().includes(q);
        const matchesEmp = s.employeeName.toLowerCase().includes(q);
        if (!matchesReceipt && !matchesCust && !matchesEmp) return false;
      }

      // Status
      if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }

      // Date range
      const saleDate = new Date(s.createdAt);
      const now = new Date();

      if (dateFilter === 'today') {
        return (
          saleDate.getDate() === now.getDate() &&
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        );
      } else if (dateFilter === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        return (
          saleDate.getDate() === yest.getDate() &&
          saleDate.getMonth() === yest.getMonth() &&
          saleDate.getFullYear() === yest.getFullYear()
        );
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return saleDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return saleDate >= monthAgo;
      }

      return true;
    });
  }, [sales, searchQuery, statusFilter, dateFilter]);

  // Open refund dialog for a sale
  const handleOpenRefund = (sale: Sale) => {
    setSaleForRefund(sale);
    // Default return qty to 0 for each line item
    const initQtys: Record<string, number> = {};
    sale.items.forEach(i => {
      initQtys[i.id] = 0;
    });
    setReturnQuantities(initQtys);
    setRefundReason(t('sales.reasonCustomerMind', 'Customer Changed Mind'));
    setRefundMethod('cash');
  };

  // Compute refund total safely in cents
  const totalRefundAmount = useMemo(() => {
    if (!saleForRefund) return 0;
    let sumCents = 0;
    saleForRefund.items.forEach(item => {
      const q = returnQuantities[item.id] || 0;
      if (q > 0) {
        const lineCents = Currency.toCents(item.lineTotal);
        const unitRefundCents = Math.round(lineCents / item.quantity);
        sumCents += unitRefundCents * q;
      }
    });
    return Currency.toDollars(sumCents);
  }, [saleForRefund, returnQuantities]);

  const handleConfirmRefund = () => {
    if (!saleForRefund) return;
    if (totalRefundAmount <= 0) {
      showToast({
        type: 'warning',
        title: t('sales.selectItemsToReturn', 'Select items to return'),
        message: t('validation.invalidQuantity', 'Specify quantity of at least 1 item.')
      });
      return;
    }

    const itemsToReturn = saleForRefund.items
      .filter(i => (returnQuantities[i.id] || 0) > 0)
      .map(i => {
        const q = returnQuantities[i.id];
        const lineCents = Currency.toCents(i.lineTotal);
        const itemRefundCents = Math.round((lineCents / i.quantity) * q);
        return {
          saleItemId: i.id,
          quantity: q,
          amount: Currency.toDollars(itemRefundCents),
          reason: refundReason
        };
      });

    requireOwnerAuth(() => {
      PosService.processRefund(
        saleForRefund,
        itemsToReturn,
        totalRefundAmount,
        refundReason,
        refundMethod,
        currentEmployee
      );

      refreshData();
      setSaleForRefund(null);
      showToast({
        type: 'success',
        title: t('toasts.refundProcessed', 'Refund Processed'),
        message: `${formatCurrency(totalRefundAmount)} ${t('sales.refundProcessedDesc', 'refunded. Inventory updated.')}`
      });
    }, t('sales.authorizeRefund', 'Authorize Sale Refund & Return'));
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header and Quick Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {t('sales.title', 'Sales & Receipts')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('sales.subtitle', 'Review transaction logs, print duplicate receipts, and process customer refunds')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              {t('sales.totalRecorded', 'Total Recorded')}: <strong className="text-slate-900 font-mono">{formatNumber(filteredSales.length)}</strong>
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('sales.searchPlaceholder', 'Search receipt #, customer, or cashier...')}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date range segmented control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', 'today', 'yesterday', 'week', 'month'] as const).map(d => {
              const labelMap: Record<string, string> = {
                all: t('sales.allTime', 'All Time'),
                today: t('sales.today', 'Today'),
                yesterday: t('sales.yesterday', 'Yesterday'),
                week: t('sales.week', 'Past 7 Days'),
                month: t('sales.month', 'Past 30 Days')
              };

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDateFilter(d)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    dateFilter === d
                      ? 'bg-white text-slate-900 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {labelMap[d]}
                </button>
              );
            })}
          </div>

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
          >
            <option value="all">{t('sales.allStatuses', 'All Statuses')}</option>
            <option value="completed">{t('sales.completed', 'Completed')}</option>
            <option value="refunded">{t('sales.refunded', 'Refunded')}</option>
            <option value="partially_refunded">{t('sales.partiallyRefunded', 'Partially Refunded')}</option>
          </select>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">{t('sales.receiptNo', 'Receipt #')}</th>
                  <th className="py-3.5 px-4">{t('sales.dateTime', 'Date & Time')}</th>
                  <th className="py-3.5 px-4">{t('sales.customer', 'Customer')}</th>
                  <th className="py-3.5 px-4">{t('sales.cashier', 'Cashier')}</th>
                  <th className="py-3.5 px-4">{t('sales.payment', 'Payment')}</th>
                  <th className="py-3.5 px-4">{t('sales.status', 'Status')}</th>
                  <th className="py-3.5 px-4 text-right">{t('sales.total', 'Total')}</th>
                  <th className="py-3.5 px-4 text-right">{t('sales.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {t('sales.noSalesFound', 'No sales matching your filter criteria.')}
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(sale => {
                    const formattedDate = formatDate(sale.createdAt, { month: 'short', day: 'numeric' });
                    const formattedTime = formatTime(sale.createdAt);

                    const statusLabels: Record<string, string> = {
                      completed: t('sales.completed', 'Completed'),
                      refunded: t('sales.refunded', 'Refunded'),
                      partially_refunded: t('sales.partiallyRefunded', 'Partially Refunded'),
                      cancelled: t('sales.cancelled', 'Cancelled')
                    };

                    const paymentLabels: Record<string, string> = {
                      cash: t('checkout.cash', 'Cash'),
                      card: t('checkout.card', 'Card'),
                      mobile: t('checkout.mobile', 'Mobile NFC'),
                      bank: t('checkout.bank', 'Bank Transfer'),
                      loyalty: t('checkout.loyalty', 'Loyalty Points')
                    };

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {sale.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formattedDate} · {formattedTime}
                        </td>
                        <td className="py-3.5 px-4">
                          {sale.customerName ? (
                            <span className="font-medium text-slate-800">{sale.customerName}</span>
                          ) : (
                            <span className="text-slate-400">{t('sales.walkIn', 'Walk-in')}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{sale.employeeName}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 capitalize font-medium text-slate-700">
                            {sale.payments[0]?.method === 'cash' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                            {sale.payments[0]?.method === 'card' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                            {sale.payments[0]?.method === 'mobile' && <Smartphone className="w-3.5 h-3.5 text-purple-600" />}
                            {sale.payments[0]?.method === 'bank' && <Building2 className="w-3.5 h-3.5 text-slate-600" />}
                            {sale.payments[0]?.method === 'loyalty' && <Award className="w-3.5 h-3.5 text-amber-600" />}
                            {paymentLabels[sale.payments[0]?.method] || sale.payments[0]?.method || t('checkout.cash', 'Cash')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold capitalize ${
                              sale.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : sale.status === 'refunded'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {statusLabels[sale.status] || sale.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedReceiptSale(sale)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title={t('sales.viewReceipt', 'View & Reprint Receipt')}
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {sale.status !== 'refunded' && (
                              <button
                                onClick={() => handleOpenRefund(sale)}
                                className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors border border-transparent hover:border-rose-200"
                                title={t('sales.processRefund', 'Process Return / Refund')}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{t('sales.refund', 'Refund')}</span>
                              </button>
                            )}
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

      {/* View Receipt Modal */}
      {selectedReceiptSale && (
        <ReceiptModal
          sale={selectedReceiptSale}
          isOpen={!!selectedReceiptSale}
          onClose={() => setSelectedReceiptSale(null)}
          onNewSale={() => setSelectedReceiptSale(null)}
        />
      )}

      {/* Return & Refund Dialog */}
      {saleForRefund && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('sales.processRefund', 'Process Return / Refund')}: {saleForRefund.receiptNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('sales.selectItemsToReturn', 'Select returned items and specify return reason')}
                </p>
              </div>
              <button
                onClick={() => setSaleForRefund(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Item selection table */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {t('sales.selectItemsToReturn', 'Select Items to Return')}
                </label>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {saleForRefund.items.map(item => {
                    const returnQty = returnQuantities[item.id] || 0;
                    return (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">
                            {translateProductName(item.productId, item.productName)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t('receipt.qty', 'Qty')}: {item.quantity} · {t('receipt.price', 'Price')}: {formatCurrency(item.lineTotal / item.quantity)} {t('pos.each', 'ea')}
                          </p>
                        </div>

                        {/* Quantity to return selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {t('sales.returnQty', 'Return Qty')}:
                          </span>
                          <select
                            value={returnQty}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10);
                              setReturnQuantities(prev => ({ ...prev, [item.id]: val }));
                            }}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold"
                          >
                            {Array.from({ length: item.quantity + 1 }, (_, idx) => (
                              <option key={idx} value={idx}>
                                {idx}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Refund Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('sales.refundReason', 'Reason for Return')}
                </label>
                <select
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                >
                  <option value={t('sales.reasonCustomerMind', 'Customer Changed Mind')}>{t('sales.reasonCustomerMind', 'Customer Changed Mind')}</option>
                  <option value={t('sales.reasonDefective', 'Defective or Damaged')}>{t('sales.reasonDefective', 'Defective or Damaged')}</option>
                  <option value={t('sales.reasonWrongItem', 'Incorrect Item Provided')}>{t('sales.reasonWrongItem', 'Incorrect Item Provided')}</option>
                  <option value={t('sales.reasonOther', 'Other Customer Request')}>{t('sales.reasonOther', 'Other Customer Request')}</option>
                </select>
              </div>

              {/* Refund Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('sales.refundMethod', 'Refund Payment Method')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'card', 'mobile', 'bank'] as const).map(m => {
                    const methodLabels: Record<string, string> = {
                      cash: t('checkout.cash', 'Cash'),
                      card: t('checkout.card', 'Card'),
                      mobile: t('checkout.mobile', 'Mobile NFC'),
                      bank: t('checkout.bank', 'Bank Transfer')
                    };

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRefundMethod(m)}
                        className={`p-2 rounded-xl border text-xs font-semibold capitalize transition-all ${
                          refundMethod === m
                            ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {methodLabels[m]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Total Refund Notice */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t('sales.total', 'Total Refund Amount')}
                </span>
                <span className="text-xl font-mono font-black text-rose-600 tabular-nums">
                  {formatCurrency(totalRefundAmount)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSaleForRefund(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={totalRefundAmount <= 0}
                onClick={handleConfirmRefund}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                {t('sales.refund', 'Confirm Refund')} ({formatCurrency(totalRefundAmount)})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
