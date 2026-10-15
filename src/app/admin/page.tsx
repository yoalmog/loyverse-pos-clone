'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, Package, Boxes, Receipt, Clock, Settings, 
  ArrowLeft, Plus, Search, RotateCcw, AlertTriangle, TrendingUp, 
  DollarSign, ShoppingBag, CheckCircle, X, Edit, Trash2, ArrowUpRight,
  Sparkles, Percent, PieChart, Wallet
} from 'lucide-react';
import { AiMenuScannerModal } from '@/components/AiMenuScannerModal';
import { ScannedMenuItem } from '@/lib/ai-menu-studio';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PRODUCTS' | 'INVENTORY' | 'ORDERS' | 'SHIFTS' | 'SETTINGS'>('DASHBOARD');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>(null);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category_id: '',
    price: '',
    cost: '',
    sku: '',
    barcode: '',
    stock_quantity: '',
    low_stock_threshold: '5',
    track_stock: true,
  });

  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [adjustTargetProduct, setAdjustTargetProduct] = useState<any>(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('Recepción de mercadería');

  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showRefundConfirmModal, setShowRefundConfirmModal] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  const [showAiMenuScannerModal, setShowAiMenuScannerModal] = useState(false);

  const handleImportMenuItems = async (scannedItems: ScannedMenuItem[]) => {
    let importedCount = 0;
    for (const item of scannedItems) {
      const cat = categories.find(c => c.name.toLowerCase() === (item.categoryName || '').toLowerCase()) || categories[0];
      try {
        await fetch('/api/backoffice/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category_id: cat?.id || '',
            price: item.priceCents,
            cost: Math.round(item.priceCents * 0.4),
            sku: item.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900),
            stock_quantity: 25,
            track_stock: 1,
            low_stock_threshold: 5,
          }),
        });
        importedCount++;
      } catch (err) {
        console.error('Error importing product:', err);
      }
    }
    alert(`Se importaron exitosamente ${importedCount} productos al catálogo.`);
    loadProducts();
  };

  // Load active tab data
  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/backoffice/dashboard');
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/backoffice/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.products);
        setCategories(data.data.categories);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadInventory = async () => {
    try {
      const res = await fetch('/api/backoffice/inventory');
      const data = await res.json();
      if (data.success) {
        setInventory(data.data.inventory);
        setInventoryLogs(data.data.logs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/backoffice/orders');
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/backoffice/settings');
      const data = await res.json();
      if (data.success) setStoreSettings(data.data.store);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadDashboard(), loadProducts(), loadInventory(), loadOrders(), loadSettings()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const formatMoney = (cents: number) => {
    const sym = storeSettings?.currency_symbol || 'S/';
    return `${sym} ${(cents / 100).toFixed(2)}`;
  };

  // Product Save/Update
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...productForm,
      id: editingProduct?.id,
      price: Math.round(parseFloat(productForm.price || '0') * 100),
      cost: Math.round(parseFloat(productForm.cost || '0') * 100),
      stock_quantity: parseFloat(productForm.stock_quantity || '0'),
      low_stock_threshold: parseFloat(productForm.low_stock_threshold || '5'),
    };

    const method = editingProduct ? 'PUT' : 'POST';
    const res = await fetch('/api/backoffice/products', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      setShowProductModal(false);
      setEditingProduct(null);
      loadProducts();
      loadInventory();
    } else {
      alert(data.error);
    }
  };

  // Stock Adjustment Submit
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetProduct) return;
    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty)) return alert('Ingrese una cantidad válida');

    const res = await fetch('/api/backoffice/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: adjustTargetProduct.id,
        changeAmount: qty,
        reason: adjustReason,
        userId: 'usr_admin',
      })
    });

    const data = await res.json();
    if (data.success) {
      setShowAdjustStockModal(false);
      setAdjustQuantity('');
      loadInventory();
      loadProducts();
    } else {
      alert(data.error);
    }
  };

  // Refund Order Submit
  const handleRefundSubmit = async () => {
    if (!refundOrderId) return;
    const res = await fetch('/api/pos/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: refundOrderId,
        userId: 'usr_admin',
        reason: 'Reembolso autorizado en Back Office',
      })
    });

    const data = await res.json();
    if (data.success) {
      alert('Reembolso completado exitosamente y stock restablecido');
      setShowRefundConfirmModal(false);
      setRefundOrderId(null);
      setSelectedReceipt(null);
      loadOrders();
      loadDashboard();
      loadInventory();
    } else {
      alert(data.error);
    }
  };

  // Settings Save Submit
  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/backoffice/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeSettings),
    });

    const data = await res.json();
    if (data.success) {
      alert('Configuración guardada exitosamente');
    } else {
      alert(data.error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="font-medium text-slate-300">Cargando Back Office...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-black shadow-md">
            L
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Back Office</h1>
            <p className="text-[11px] text-slate-400">Loyverse POS System</p>
          </div>
        </div>

        {/* Back to POS Button */}
        <div className="p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 px-3 py-2.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Punto de Venta</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-3">
          {[
            { id: 'DASHBOARD', label: 'Resumen & Métricas', icon: LayoutDashboard },
            { id: 'PRODUCTS', label: 'Productos & Catálogo', icon: Package },
            { id: 'INVENTORY', label: 'Gestión de Inventario', icon: Boxes },
            { id: 'ORDERS', label: 'Ventas & Recibos', icon: Receipt },
            { id: 'SHIFTS', label: 'Turnos de Caja', icon: Clock },
            { id: 'SETTINGS', label: 'Configuración', icon: Settings },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="border-t border-slate-800 p-4 text-[11px] text-slate-500">
          <span>{storeSettings?.legal_name || 'Loyverse Clone v1.0'}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-8">
          <h2 className="text-lg font-bold text-white">
            {activeTab === 'DASHBOARD' && 'Panel de Control y Analítica de Ventas'}
            {activeTab === 'PRODUCTS' && 'Catálogo de Productos y Modificadores'}
            {activeTab === 'INVENTORY' && 'Control de Stock y Ajustes de Inventario'}
            {activeTab === 'ORDERS' && 'Historial de Transacciones, Recibos y Reembolsos'}
            {activeTab === 'SHIFTS' && 'Auditoría de Turnos y Cierres de Caja (Reporte Z)'}
            {activeTab === 'SETTINGS' && 'Ajustes del Negocio, Impuestos (IGV) y Comprobantes'}
          </h2>
          <div className="text-xs text-slate-400">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-6">
              {/* Metric Cards: 6-grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ventas Brutas</span>
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {formatMoney(stats?.totals?.gross_sales || 0)}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{stats?.totals?.total_orders || 0} pedidos</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ventas Netas</span>
                    <TrendingUp className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {formatMoney(stats?.totals?.net_sales || 0)}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Sin descuentos</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Costo (COGS)</span>
                    <Boxes className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {formatMoney(Math.round((stats?.totals?.net_sales || 0) * 0.38))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Costo mercadería</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Margen Bruto</span>
                    <Percent className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {(stats?.totals?.net_sales || 0) > 0 ? '62.0%' : '0.0%'}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Rentabilidad estimada</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ticket Promedio</span>
                    <ShoppingBag className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {formatMoney(stats?.totals?.total_orders ? Math.round(stats.totals.gross_sales / stats.totals.total_orders) : 0)}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Por transacción</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Reembolsos</span>
                    <RotateCcw className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {formatMoney(stats?.totals?.refunded_sales || 0)}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Devoluciones</p>
                </div>
              </div>

              {/* Top Selling Products & Low Stock Alerts */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Top Items */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
                    Top Productos Más Vendidos
                  </h3>
                  <div className="space-y-3">
                    {stats?.topItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-400">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-white">{item.product_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-emerald-400">{formatMoney(item.total_revenue)}</span>
                          <span className="block text-[11px] text-slate-500">{item.quantity_sold} unid.</span>
                        </div>
                      </div>
                    ))}
                    {(!stats?.topItems || stats.topItems.length === 0) && (
                      <p className="text-xs text-slate-500 py-4 text-center">Sin ventas registradas aún</p>
                    )}
                  </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span>Alertas de Stock Bajo</span>
                  </h3>
                  <div className="space-y-3">
                    {stats?.lowStockItems?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                        <div>
                          <span className="text-sm font-medium text-white">{item.name}</span>
                          <span className="block text-[11px] text-slate-500">SKU: {item.sku || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-md bg-amber-950 border border-amber-800 px-2 py-0.5 text-xs font-bold text-amber-300">
                            {item.stock_quantity} restante
                          </span>
                          <button
                            onClick={() => {
                              setAdjustTargetProduct(item);
                              setShowAdjustStockModal(true);
                            }}
                            className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-indigo-400 hover:bg-slate-700"
                          >
                            Reponer
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!stats?.lowStockItems || stats.lowStockItems.length === 0) && (
                      <p className="text-xs text-slate-500 py-4 text-center">Todo el inventario está en niveles óptimos</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS */}
          {activeTab === 'PRODUCTS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">{products.length} productos registrados</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAiMenuScannerModal(true)}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-purple-500 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Escanear Menú con IA</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingProduct(null);
                      setProductForm({
                        name: '',
                        category_id: categories[0]?.id || '',
                        price: '',
                        cost: '',
                        sku: '',
                        barcode: '',
                        stock_quantity: '10',
                        low_stock_threshold: '5',
                        track_stock: true,
                      });
                      setShowProductModal(true);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-500"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Nuevo Producto</span>
                  </button>
                </div>
              </div>

              {/* Products Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-4">Producto</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4">Precio Venta</th>
                      <th className="p-4">Costo</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">SKU / Barcode</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="p-4 font-semibold text-white flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color || '#10b981' }} />
                          {p.name}
                        </td>
                        <td className="p-4 text-slate-400">{p.category_name || 'Sin categoría'}</td>
                        <td className="p-4 font-bold text-emerald-400">{formatMoney(p.price)}</td>
                        <td className="p-4 text-slate-400">{formatMoney(p.cost)}</td>
                        <td className="p-4">
                          <span className={`font-semibold ${p.stock_quantity <= p.low_stock_threshold ? 'text-amber-400' : 'text-slate-300'}`}>
                            {p.track_stock ? `${p.stock_quantity} u.` : 'Sin límite'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-400">
                          {p.barcode || p.sku || '-'}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setProductForm({
                                name: p.name,
                                category_id: p.category_id || '',
                                price: (p.price / 100).toFixed(2),
                                cost: (p.cost / 100).toFixed(2),
                                sku: p.sku || '',
                                barcode: p.barcode || '',
                                stock_quantity: String(p.stock_quantity),
                                low_stock_threshold: String(p.low_stock_threshold),
                                track_stock: p.track_stock === 1,
                              });
                              setShowProductModal(true);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === 'INVENTORY' && (
            <div className="space-y-6">
              {/* Inventory Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-4">Producto</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4">Stock Actual</th>
                      <th className="p-4">Alerta Mínima</th>
                      <th className="p-4 text-right">Ajuste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {inventory.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="p-4 font-semibold text-white">{item.name}</td>
                        <td className="p-4 text-slate-400">{item.category_name}</td>
                        <td className="p-4">
                          <span className={`rounded-md px-2 py-0.5 font-bold ${
                            item.stock_quantity <= 0 
                              ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                              : item.stock_quantity <= item.low_stock_threshold
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'text-slate-200'
                          }`}>
                            {item.stock_quantity} unidades
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{item.low_stock_threshold} unidades</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setAdjustTargetProduct(item);
                              setShowAdjustStockModal(true);
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                          >
                            Ajustar Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Movement Logs */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Registro de Movimientos de Inventario (Kardex)
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {inventoryLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between border-b border-slate-800/60 py-2 text-xs">
                      <div>
                        <span className="font-semibold text-white">{log.product_name}</span>
                        <span className="ml-2 text-slate-500">Motivo: {log.reason}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${log.change_amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount} u.
                        </span>
                        <span className="text-slate-500">
                          {new Date(log.created_at).toLocaleString('es-PE')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ORDERS & RECEIPTS */}
          {activeTab === 'ORDERS' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-4">Recibo #</th>
                      <th className="p-4">Fecha y Hora</th>
                      <th className="p-4">Cajero</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Método</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-right">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-800/40">
                        <td className="p-4 font-mono font-bold text-white">{o.receipt_number}</td>
                        <td className="p-4 text-slate-400">{new Date(o.created_at).toLocaleString('es-PE')}</td>
                        <td className="p-4 text-slate-300">{o.cashier_name}</td>
                        <td className="p-4 text-slate-400">{o.customer_name || 'General'}</td>
                        <td className="p-4 font-semibold text-slate-300">{o.payment_method}</td>
                        <td className="p-4 font-black text-emerald-400">{formatMoney(o.total)}</td>
                        <td className="p-4">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            o.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : o.status === 'REFUNDED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {o.status === 'COMPLETED' ? 'Completado' : o.status === 'REFUNDED' ? 'Reembolsado' : 'Guardado'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/backoffice/orders?id=${o.id}`);
                              const data = await res.json();
                              if (data.success) setSelectedReceipt(data.data);
                            }}
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            Ver Recibo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SHIFTS */}
          {activeTab === 'SHIFTS' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="p-4">Cajero</th>
                      <th className="p-4">Apertura</th>
                      <th className="p-4">Cierre</th>
                      <th className="p-4">Fondo Inicial</th>
                      <th className="p-4">Efectivo Esperado</th>
                      <th className="p-4">Efectivo Real</th>
                      <th className="p-4">Diferencia</th>
                      <th className="p-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {stats?.recentShifts?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-4 font-semibold text-white">{s.cashier_name}</td>
                        <td className="p-4 text-slate-400">{new Date(s.opened_at).toLocaleString('es-PE')}</td>
                        <td className="p-4 text-slate-400">{s.closed_at ? new Date(s.closed_at).toLocaleString('es-PE') : '-'}</td>
                        <td className="p-4 text-slate-300">{formatMoney(s.opening_cash)}</td>
                        <td className="p-4 font-bold text-white">{formatMoney(s.expected_cash || 0)}</td>
                        <td className="p-4 font-bold text-white">{s.actual_cash ? formatMoney(s.actual_cash) : '-'}</td>
                        <td className="p-4 font-bold">
                          {s.cash_difference !== null && s.cash_difference !== undefined ? (
                            <span className={s.cash_difference === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                              {formatMoney(s.cash_difference)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            s.status === 'OPEN' 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {s.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'SETTINGS' && storeSettings && (
            <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Nombre Comercial</label>
                    <input
                      type="text"
                      value={storeSettings.name}
                      onChange={e => setStoreSettings({ ...storeSettings, name: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Razón Social</label>
                    <input
                      type="text"
                      value={storeSettings.legal_name || ''}
                      onChange={e => setStoreSettings({ ...storeSettings, legal_name: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">RUC / Identificación Fiscal</label>
                    <input
                      type="text"
                      value={storeSettings.tax_id || ''}
                      onChange={e => setStoreSettings({ ...storeSettings, tax_id: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Teléfono</label>
                    <input
                      type="text"
                      value={storeSettings.phone || ''}
                      onChange={e => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Dirección</label>
                  <input
                    type="text"
                    value={storeSettings.address || ''}
                    onChange={e => setStoreSettings({ ...storeSettings, address: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Moneda</label>
                    <input
                      type="text"
                      value={storeSettings.currency_code}
                      onChange={e => setStoreSettings({ ...storeSettings, currency_code: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Símbolo</label>
                    <input
                      type="text"
                      value={storeSettings.currency_symbol}
                      onChange={e => setStoreSettings({ ...storeSettings, currency_symbol: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Tasa Impuesto (IGV)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={storeSettings.tax_rate}
                      onChange={e => setStoreSettings({ ...storeSettings, tax_rate: parseFloat(e.target.value) })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Pie del Recibo Térmico</label>
                  <textarea
                    rows={2}
                    value={storeSettings.receipt_footer || ''}
                    onChange={e => setStoreSettings({ ...storeSettings, receipt_footer: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500"
                >
                  Guardar Configuración
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODALS ================= */}

      {/* 1. PRODUCT ADD/EDIT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Nombre</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Categoría</label>
                <select
                  value={productForm.category_id}
                  onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Precio Venta (S/)</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Costo (S/)</label>
                  <input
                    type="number"
                    step="0.10"
                    value={productForm.cost}
                    onChange={e => setProductForm({ ...productForm, cost: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Stock Inicial</label>
                  <input
                    type="number"
                    value={productForm.stock_quantity}
                    onChange={e => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Alerta Mínima</label>
                  <input
                    type="number"
                    value={productForm.low_stock_threshold}
                    onChange={e => setProductForm({ ...productForm, low_stock_threshold: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">SKU</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase">Código de Barra</label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={e => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 mt-2"
              >
                {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADJUST STOCK MODAL */}
      {showAdjustStockModal && adjustTargetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Ajustar Inventario</h3>
              <button onClick={() => setShowAdjustStockModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Producto: <span className="text-white font-bold">{adjustTargetProduct.name}</span>
              <br />
              Stock actual: <span className="text-emerald-400 font-bold">{adjustTargetProduct.stock_quantity} u.</span>
            </div>

            <form onSubmit={handleAdjustStockSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">
                  Cantidad a sumar o restar (+ / -)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="Ej. +20 o -5"
                  value={adjustQuantity}
                  onChange={e => setAdjustQuantity(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-base font-bold text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Motivo</label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="Recepción de mercadería">Recepción de mercadería</option>
                  <option value="Inventario físico / Recuento">Inventario físico / Recuento</option>
                  <option value="Pérdida / Merma / Vencimiento">Pérdida / Merma / Vencimiento</option>
                  <option value="Devolución de cliente">Devolución de cliente</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500"
              >
                Aplicar Ajuste de Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. RECEIPT PREVIEW & REFUND MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <h3 className="text-sm font-bold text-white">Comprobante {selectedReceipt.receipt_number}</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              <div className="space-y-1 rounded-xl bg-slate-950 p-3 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Fecha:</span>
                  <span className="text-white">{new Date(selectedReceipt.created_at).toLocaleString('es-PE')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cajero:</span>
                  <span className="text-white">{selectedReceipt.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estado:</span>
                  <span className={`font-bold uppercase ${selectedReceipt.status === 'REFUNDED' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedReceipt.status}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 border-t border-b border-slate-800 py-3">
                {selectedReceipt.items?.map((it: any) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.quantity} x {it.product_name}</span>
                    <span className="font-semibold text-white">{formatMoney(it.total)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-black text-sm pt-1">
                <span>TOTAL:</span>
                <span className="text-emerald-400">{formatMoney(selectedReceipt.total)}</span>
              </div>
            </div>

            {/* Refund Action */}
            <div className="border-t border-slate-800 p-4">
              {selectedReceipt.status === 'COMPLETED' ? (
                <button
                  onClick={() => {
                    setRefundOrderId(selectedReceipt.id);
                    setShowRefundConfirmModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600/20 border border-rose-500/40 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Procesar Reembolso / Devolución</span>
                </button>
              ) : (
                <div className="rounded-xl bg-slate-800 p-2.5 text-center text-xs text-rose-400 font-semibold">
                  Esta venta ya fue reembolsada
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. CONFIRM REFUND MODAL */}
      {showRefundConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-white">¿Confirmar Reembolso?</h3>
            <p className="text-xs text-slate-400">
              Esta acción devolverá los artículos al stock del inventario y marcará el ticket como REEMBOLSADO.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRefundConfirmModal(false)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleRefundSubmit}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500"
              >
                Sí, Reembolsar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. AI MENU SCANNER & FOOD STUDIO MODAL */}
      <AiMenuScannerModal
        isOpen={showAiMenuScannerModal}
        onClose={() => setShowAiMenuScannerModal(false)}
        onImportItems={handleImportMenuItems}
      />
    </div>
  );
}

