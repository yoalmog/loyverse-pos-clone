import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { StorageService } from '../../services/storageService.ts';
import { Sale, CartItem, HeldOrder } from '../../types/pos.ts';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Filter,
  Check,
  Coffee,
  ShoppingBag,
  Truck,
  Flame
} from 'lucide-react';

export interface KdsOrder {
  id: string;
  sourceType: 'sale' | 'held';
  ticketNumber: string;
  tableName?: string;
  serverName: string;
  diningOption: string;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    variantName?: string;
    quantity: number;
    modifiers: string[];
    notes?: string;
    completed: boolean;
  }>;
  status: 'active' | 'completed';
  completedAt?: string;
}

export const KitchenDisplayView: React.FC = () => {
  const { currentStoreId, currentEmployee, showToast, t } = usePOS();

  // Internal state
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [filterStation, setFilterStation] = useState<'all' | 'kitchen' | 'bar'>('all');
  const [filterDining, setFilterDining] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRecallDrawer, setShowRecallDrawer] = useState<boolean>(false);
  const [completedHistory, setCompletedHistory] = useState<KdsOrder[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const prevOrderCountRef = useRef<number>(0);

  // Play audio chime using Web Audio API
  const playChime = (type: 'new' | 'bump' = 'new') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'new') {
        // High double-beep for new order
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
        // Gentle confirmation chime
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (_) {}
  };

  // Clock ticker every 1 second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll & synchronize active orders from storage
  const syncKdsOrders = () => {
    try {
      const rawSales: Sale[] = StorageService.getSales();
      const rawHeld: HeldOrder[] = StorageService.getHeldOrders();
      const bumpedIds = new Set(
        JSON.parse(localStorage.getItem('aurapos_kds_bumped_ids') || '[]')
      );

      const kdsList: KdsOrder[] = [];

      // 1. Process recent sales (orders within last 8 hours)
      const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
      rawSales.forEach(s => {
        if (bumpedIds.has(s.id)) return;
        const saleTime = new Date(s.createdAt).getTime();
        if (saleTime < eightHoursAgo) return;

        kdsList.push({
          id: s.id,
          sourceType: 'sale',
          ticketNumber: s.receiptNumber || `Order #${s.id.slice(-4)}`,
          tableName: (s as any).tableName,
          serverName: s.employeeName || 'Cashier',
          diningOption: (s as any).diningOption || 'Dine-In',
          createdAt: s.createdAt,
          items: s.items.map((it, idx) => ({
            id: `${s.id}_item_${idx}`,
            name: it.productName,
            variantName: it.variantName,
            quantity: it.quantity,
            modifiers: (it as any).modifiers ? (it as any).modifiers.map((m: any) => (typeof m === 'string' ? m : m.name)) : [],
            notes: (it as any).notes,
            completed: false
          })),
          status: 'active'
        });
      });

      // 2. Process active open/held kitchen tickets
      rawHeld.forEach(h => {
        if (bumpedIds.has(h.id)) return;
        kdsList.push({
          id: h.id,
          sourceType: 'held',
          ticketNumber: h.orderNumber || (h as any).name || `Ticket #${h.id.slice(-4)}`,
          tableName: h.orderNumber?.toLowerCase().includes('table') ? h.orderNumber : undefined,
          serverName: h.employeeName || 'Server',
          diningOption: (h as any).diningOption || 'Dine-In',
          createdAt: h.createdAt,
          items: h.items.map((it: CartItem, idx: number) => ({
            id: `${h.id}_item_${idx}`,
            name: it.productName,
            variantName: it.variantName,
            quantity: it.quantity,
            modifiers: (it as any).selectedModifiers ? (it as any).selectedModifiers.map((m: any) => m.name || m) : [],
            notes: it.notes,
            completed: false
          })),
          status: 'active'
        });
      });

      // Sort by creation time (oldest orders first - FIFO kitchen queue)
      kdsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // If new orders arrived, trigger chime
      if (kdsList.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
        playChime('new');
      }
      prevOrderCountRef.current = kdsList.length;

      setOrders(kdsList);
    } catch (err) {
      console.warn('KDS sync error:', err);
    }
  };

  useEffect(() => {
    syncKdsOrders();
    const interval = setInterval(syncKdsOrders, 3000); // Poll every 3 seconds for new orders
    return () => clearInterval(interval);
  }, [currentStoreId]);

  // Toggle individual item completion
  const handleToggleItem = (orderId: string, itemId: string) => {
    setOrders(prev =>
      prev.map(ord => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          items: ord.items.map(it => (it.id === itemId ? { ...it, completed: !it.completed } : it))
        };
      })
    );
  };

  // Bump / Complete Order
  const handleBumpOrder = (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;

    playChime('bump');

    // Add to bumped ID set in storage
    const bumpedIds = new Set(
      JSON.parse(localStorage.getItem('aurapos_kds_bumped_ids') || '[]')
    );
    bumpedIds.add(orderId);
    localStorage.setItem('aurapos_kds_bumped_ids', JSON.stringify(Array.from(bumpedIds)));

    const completedOrder: KdsOrder = {
      ...target,
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    setCompletedHistory(prev => [completedOrder, ...prev.slice(0, 19)]);
    setOrders(prev => prev.filter(o => o.id !== orderId));

    showToast({
      type: 'success',
      title: 'Order Completed',
      message: `${target.ticketNumber} marked ready and bumped.`
    });
  };

  // Recall Completed Order
  const handleRecallOrder = (orderId: string) => {
    const bumpedIds = new Set(
      JSON.parse(localStorage.getItem('aurapos_kds_bumped_ids') || '[]')
    );
    bumpedIds.delete(orderId);
    localStorage.setItem('aurapos_kds_bumped_ids', JSON.stringify(Array.from(bumpedIds)));

    setCompletedHistory(prev => prev.filter(o => o.id !== orderId));
    syncKdsOrders();
    showToast({
      type: 'info',
      title: 'Order Recalled',
      message: 'Order returned to active kitchen display.'
    });
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      if (filterDining !== 'all' && ord.diningOption.toLowerCase() !== filterDining.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [orders, filterDining]);

  // Elapsed time formatter
  const getElapsedSeconds = (createdAt: string) => {
    const start = new Date(createdAt).getTime();
    const now = currentTime.getTime();
    return Math.max(0, Math.floor((now - start) / 1000));
  };

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-white overflow-hidden select-none">
      {/* KDS Top Bar */}
      <header className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>Kitchen Display System</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  KDS LIVE
                </span>
              </h1>
              <span className="text-[11px] text-slate-400">Station Order Bump Screen (Loyverse 9.20–9.22)</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-800">
            {(['all', 'dine-in', 'takeout', 'delivery'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setFilterDining(opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                  filterDining === opt
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {opt === 'all' ? 'All Orders' : opt}
              </button>
            ))}
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-black font-mono">
            {filteredOrders.length} ACTIVE
          </span>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-rose-950 border-rose-800 text-rose-400'
            }`}
            title={soundEnabled ? 'Mute Chimes' : 'Unmute Chimes'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowRecallDrawer(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Recall ({completedHistory.length})</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Board View: Ticket Cards Grid */}
      <main className="flex-1 p-6 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-500 shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">All Caught Up!</h2>
              <p className="text-sm text-slate-400 mt-1">
                Zero pending orders in queue. New tickets placed from POS registers will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {filteredOrders.map(order => {
              const elapsedSecs = getElapsedSeconds(order.createdAt);
              // Urgency thresholds: < 5m Normal (green), 5-10m Warning (yellow), > 10m Urgent (red)
              const isUrgent = elapsedSecs >= 600;
              const isWarning = elapsedSecs >= 300 && elapsedSecs < 600;

              const headerBg = isUrgent
                ? 'bg-rose-950/80 border-rose-600 text-rose-200'
                : isWarning
                ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-slate-200';

              const cardBorder = isUrgent
                ? 'border-rose-600 ring-1 ring-rose-500/50'
                : isWarning
                ? 'border-amber-600'
                : 'border-slate-800';

              const DiningIcon =
                order.diningOption.toLowerCase().includes('take') ? ShoppingBag :
                order.diningOption.toLowerCase().includes('deliv') ? Truck : UtensilsCrossed;

              const allItemsDone = order.items.every(i => i.completed);

              return (
                <div
                  key={order.id}
                  className={`bg-slate-900 rounded-2xl border ${cardBorder} shadow-xl overflow-hidden flex flex-col animate-in fade-in transition-all`}
                >
                  {/* Ticket Header */}
                  <div className={`p-4 border-b flex items-start justify-between ${headerBg}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black tracking-tight">{order.ticketNumber}</span>
                        {order.tableName && (
                          <span className="px-2 py-0.5 rounded-lg bg-black/40 text-[11px] font-bold">
                            {order.tableName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] opacity-80">
                        <DiningIcon className="w-3.5 h-3.5" />
                        <span className="font-semibold">{order.diningOption}</span>
                        <span>•</span>
                        <span>{order.serverName}</span>
                      </div>
                    </div>

                    {/* Urgency Timer Badge */}
                    <div
                      className={`px-2.5 py-1 rounded-xl font-mono font-black text-xs flex items-center gap-1.5 shadow-sm ${
                        isUrgent
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isWarning
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatElapsed(elapsedSecs)}</span>
                    </div>
                  </div>

                  {/* Ticket Line Items Checklist */}
                  <div className="p-4 space-y-3 flex-1 divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
                    {order.items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(order.id, item.id)}
                        className={`pt-2.5 first:pt-0 flex items-start gap-3 cursor-pointer group transition-opacity ${
                          item.completed ? 'opacity-40' : 'opacity-100'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            item.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-700 bg-slate-800 group-hover:border-slate-500'
                          }`}
                        >
                          {item.completed && <Check className="w-3.5 h-3.5" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-black font-mono text-orange-400">
                              {item.quantity}×
                            </span>
                            <span
                              className={`text-sm font-bold leading-tight ${
                                item.completed ? 'line-through text-slate-400' : 'text-slate-100'
                              }`}
                            >
                              {item.name}
                            </span>
                          </div>

                          {item.variantName && (
                            <span className="text-xs text-slate-400 font-medium block mt-0.5">
                              ({item.variantName})
                            </span>
                          )}

                          {item.modifiers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.modifiers.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-amber-400 border border-slate-700"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.notes && (
                            <p className="text-[11px] text-rose-400 font-semibold italic mt-1">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ticket Footer / BUMP Button */}
                  <div className="p-3 bg-slate-950 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleBumpOrder(order.id)}
                      className={`w-full py-3 rounded-xl font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                        allItemsDone
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-orange-600 hover:bg-orange-700 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>{allItemsDone ? 'COMPLETE & BUMP' : 'BUMP ORDER'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Completed Orders Recall Drawer */}
      {showRecallDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-sm text-white">Recently Bumped Orders</h3>
              </div>
              <button
                onClick={() => setShowRecallDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {completedHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-12">
                  No bumped orders in this session yet.
                </p>
              ) : (
                completedHistory.map(order => (
                  <div
                    key={order.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{order.ticketNumber}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {order.completedAt ? new Date(order.completedAt).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    <p className="text-slate-400">
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </p>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleRecallOrder(order.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Recall to Board</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
