import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Clock, Play, Trash2, X, Search, ShoppingBag, User } from 'lucide-react';

export const HeldOrdersModal: React.FC = () => {
  const {
    openHeldOrdersModal,
    setOpenHeldOrdersModal,
    heldOrders,
    resumeOrder,
    deleteHeldOrder,
    formatCurrency,
    formatTime,
    translateProductName,
    t
  } = usePOS();

  const [search, setSearch] = useState<string>('');

  if (!openHeldOrdersModal) return null;

  const filteredOrders = heldOrders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.customer && `${o.customer.firstName} ${o.customer.lastName}`.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-100 flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t('pos.heldOrders', 'Held Orders & Parked Tickets')}</h3>
              <p className="text-xs text-slate-500">{heldOrders.length} {t('pos.heldOrders', 'ticket(s) held')}</p>
            </div>
          </div>
          <button
            onClick={() => setOpenHeldOrdersModal(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        {heldOrders.length > 2 && (
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('sales.searchPlaceholder', 'Search ticket # or customer...')}
                className="w-full bg-white text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{t('pos.noHeldOrders', 'No held orders found')}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t('pos.holdCart', 'Hold an order to park it for later checkout.')}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const formattedTime = formatTime(order.createdAt);

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-white shadow-2xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {order.orderNumber}
                      </span>
                      <span className="text-[11px] text-slate-400">{formattedTime}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium">
                        {order.customer
                          ? `${order.customer.firstName} ${order.customer.lastName}`
                          : t('pos.walkInCustomer', 'Walk-in Customer')}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      {order.items.map(i => `${i.quantity}x ${translateProductName(i.productId, i.productName)}`).join(', ')}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-mono font-bold text-slate-900 tabular-nums">
                      {formatCurrency(order.total)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => deleteHeldOrder(order.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => resumeOrder(order.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t('pos.resumeOrder', 'Resume')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
