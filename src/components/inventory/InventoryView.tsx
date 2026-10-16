import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { Product, InventoryMovement, InventoryMovementType } from '../../types/pos.ts';
import {
  Supplier,
  PurchaseOrder,
  StockCountSession,
  StockCountItem,
  InventoryValuationSummary
} from '../../types/inventoryOperations.ts';
import { PosService } from '../../services/posService.ts';
import { InventoryService } from '../../services/inventoryService.ts';
import { StorageService } from '../../services/storageService.ts';
import {
  Layers,
  AlertTriangle,
  PackageCheck,
  TrendingDown,
  DollarSign,
  Plus,
  Minus,
  Edit3,
  History,
  Search,
  Filter,
  X,
  ClipboardList,
  Truck,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Check
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const {
    products,
    categories,
    inventoryMovements,
    currentEmployee,
    refreshData,
    showToast,
    isOwner,
    requireOwnerAuth,
    translateProductName,
    currentStoreId,
    t
  } = usePOS();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'counts' | 'suppliers'>('stock');

  // Search & Filter
  const [search, setSearch] = useState<string>('');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'out'>('all');
  const [filterMovementType, setFilterMovementType] = useState<string>('all');

  // Suppliers & Purchase Orders State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCountSession[]>([]);

  // Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjQuantity, setAdjQuantity] = useState<string>('5');
  const [adjReason, setAdjReason] = useState<string>('Purchase / Restock');
  const [adjNotes, setAdjNotes] = useState<string>('');

  // New Supplier Modal
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierContact, setNewSupplierContact] = useState<string>('');
  const [newSupplierEmail, setNewSupplierEmail] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');

  // New PO Modal
  const [showCreatePOModal, setShowCreatePOModal] = useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [poItems, setPoItems] = useState<Array<{ productId: string; qty: number; cost: number }>>([]);

  // Physical Count Session State
  const [activeCountSession, setActiveCountSession] = useState<StockCountSession | null>(null);

  // Load Inventory Operations Data
  useEffect(() => {
    setSuppliers(StorageService.getSuppliers(currentStoreId));
    setPurchaseOrders(StorageService.getPurchaseOrders(currentStoreId));
    setStockCounts(StorageService.getStockCountSessions(currentStoreId));
  }, [currentStoreId]);

  // Inventory Valuation Summary
  const valuation: InventoryValuationSummary = useMemo(() => {
    return InventoryService.getValuationSummary(products);
  }, [products]);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterStockStatus === 'low') {
        if (!p.trackInventory || p.stock <= 0 || p.stock > p.lowStockThreshold) return false;
      } else if (filterStockStatus === 'out') {
        if (!p.trackInventory || p.stock > 0) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, filterStockStatus, search]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    return inventoryMovements.filter(m => {
      if (filterMovementType !== 'all' && m.type !== filterMovementType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.productName.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inventoryMovements, filterMovementType, search]);

  // Adjustment Handlers
  const handleOpenAdjust = (p: Product) => {
    requireOwnerAuth(() => {
      setAdjustingProduct(p);
      setAdjType('add');
      setAdjQuantity('5');
      setAdjReason('Purchase / Restock');
      setAdjNotes('');
    }, t('inventory.adjustOwnerAuth', 'Adjust Inventory Stock Levels'));
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const qty = parseInt(adjQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      showToast({ type: 'warning', title: 'Invalid quantity' });
      return;
    }

    requireOwnerAuth(() => {
      const fullReason = adjNotes.trim() ? `${adjReason} - ${adjNotes.trim()}` : adjReason;
      PosService.adjustStock(adjustingProduct.id, adjType, qty, fullReason, currentEmployee);
      refreshData();
      setAdjustingProduct(null);
      showToast({
        type: 'success',
        title: 'Stock Updated',
        message: `Inventory stock adjusted for ${adjustingProduct.name}`
      });
    }, 'Confirm Stock Adjustment');
  };

  // Export CSV Handlers
  const handleExportValuationCSV = () => {
    const csv = InventoryService.generateInventoryValuationCsv(products, categories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_valuation_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast({ type: 'success', title: 'Inventory Valuation CSV Exported' });
  };

  const handleExportMovementsCSV = () => {
    const csv = InventoryService.generateMovementsCsv(filteredMovements);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_movements_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast({ type: 'success', title: 'Stock Movements CSV Exported' });
  };

  // Physical Count Workflow
  const handleStartPhysicalCount = () => {
    const session = InventoryService.createStockCountSession(
      currentStoreId,
      currentEmployee?.name || 'Staff Auditor',
      `Audit Count #${stockCounts.length + 1} (${new Date().toLocaleDateString()})`
    );
    setActiveCountSession(session);
    setStockCounts(StorageService.getStockCountSessions(currentStoreId));
    showToast({ type: 'info', title: 'Audit Count Started', message: 'Enter actual physical quantities counted.' });
  };

  const handleCommitPhysicalCount = () => {
    if (!activeCountSession) return;
    try {
      const res = InventoryService.commitStockCountSession(
        activeCountSession.id,
        currentEmployee?.name || 'Staff Auditor'
      );
      setActiveCountSession(null);
      setStockCounts(StorageService.getStockCountSessions(currentStoreId));
      refreshData();
      showToast({
        type: 'success',
        title: 'Audit Reconciled',
        message: `Stock reconciled. Net variance: ${res.session.totalVarianceUnits} units ($${res.session.totalVarianceValue.toFixed(2)})`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Audit Failed', message: err.message });
    }
  };

  // Supplier & PO Handlers
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const newSup: Supplier = {
      id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: currentStoreId,
      name: newSupplierName.trim(),
      contactPerson: newSupplierContact.trim(),
      email: newSupplierEmail.trim(),
      phone: newSupplierPhone.trim(),
      active: true,
      createdAt: new Date().toISOString()
    };

    const updated = [newSup, ...suppliers];
    setSuppliers(updated);
    StorageService.saveSuppliers(updated);
    setShowAddSupplierModal(false);
    setNewSupplierName('');
    setNewSupplierContact('');
    setNewSupplierEmail('');
    setNewSupplierPhone('');
    showToast({ type: 'success', title: 'Supplier Created', message: `${newSup.name} added to directory.` });
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poItems.length === 0) {
      showToast({ type: 'warning', title: 'Select a supplier and at least one item.' });
      return;
    }

    const sup = suppliers.find(s => s.id === selectedSupplierId);
    if (!sup) return;

    const items = poItems.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return {
        id: `poi_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        productId: item.productId,
        productName: prod?.name || 'Product',
        sku: prod?.sku || '',
        quantityOrdered: item.qty,
        quantityReceived: 0,
        unitCost: item.cost,
        totalCost: item.qty * item.cost
      };
    });

    const newOrder = InventoryService.createPurchaseOrder({
      storeId: currentStoreId,
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      status: 'ordered',
      items,
      totalAmount: items.reduce((acc, i) => acc + i.totalCost, 0),
      orderDate: new Date().toISOString(),
      createdBy: currentEmployee?.name || 'Staff'
    });

    setPurchaseOrders(StorageService.getPurchaseOrders(currentStoreId));
    setShowCreatePOModal(false);
    setPoItems([]);
    setSelectedSupplierId('');
    showToast({ type: 'success', title: 'PO Issued', message: `Order ${newOrder.poNumber} sent to ${sup.name}.` });
  };

  const handleReceivePO = (poId: string) => {
    try {
      const res = InventoryService.receivePurchaseOrder(poId, currentEmployee?.name || 'Receiving Staff');
      setPurchaseOrders(StorageService.getPurchaseOrders(currentStoreId));
      refreshData();
      showToast({
        type: 'success',
        title: 'Goods Received',
        message: `${res.order.poNumber} received. Stock levels updated.`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Receiving Error', message: err.message });
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Inventory & Stock Control
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time stock valuation, movements audit ledger, physical counts, and purchase orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'stock' && (
              <button
                onClick={handleExportValuationCSV}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Valuation CSV</span>
              </button>
            )}

            {activeTab === 'movements' && (
              <button
                onClick={handleExportMovementsCSV}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Ledger CSV</span>
              </button>
            )}

            {activeTab === 'counts' && !activeCountSession && (
              <button
                onClick={handleStartPhysicalCount}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Count</span>
              </button>
            )}

            {activeTab === 'suppliers' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddSupplierModal(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Supplier</span>
                </button>
                <button
                  onClick={() => setShowCreatePOModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Create PO</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Valuation KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tracked SKUs</span>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {valuation.totalTrackedProducts}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Physical Units</span>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {valuation.totalUnitsInStock}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Retail Valuation</span>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
              ${valuation.totalRetailValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cost Valuation</span>
            <p className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono mt-1">
              ${valuation.totalCostValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Expected Profit</span>
            <p className="text-xl font-black text-emerald-600 font-mono mt-1">
              ${valuation.potentialGrossProfit.toFixed(2)}
            </p>
            <span className="text-[10px] text-emerald-500 font-bold">{valuation.overallMarginPct}% margin</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Low / Out Stock</span>
            <p className="text-xl font-black text-amber-600 font-mono mt-1">
              {valuation.lowStockItemsCount} / {valuation.outOfStockItemsCount}
            </p>
          </div>
        </div>

        {/* Tab Selector Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {[
            { id: 'stock', label: 'Stock Levels & Alerts', icon: Layers },
            { id: 'movements', label: 'Movements Audit Ledger', icon: History },
            { id: 'counts', label: 'Physical Stock Counts', icon: ClipboardList },
            { id: 'suppliers', label: 'Suppliers & Purchase Orders', icon: Truck }
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Stock Levels & Alerts */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter stock by name or SKU..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                {(['all', 'low', 'out'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterStockStatus(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                      filterStockStatus === st
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {st === 'all' ? 'All Stock' : st === 'low' ? 'Low Stock Alerts' : 'Out of Stock'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Product / SKU</th>
                    <th className="px-4 py-3 font-bold">Category</th>
                    <th className="px-4 py-3 font-bold text-right">Units in Stock</th>
                    <th className="px-4 py-3 font-bold text-right">Min Threshold</th>
                    <th className="px-4 py-3 font-bold text-right">Unit Cost</th>
                    <th className="px-4 py-3 font-bold text-right">Retail Price</th>
                    <th className="px-4 py-3 font-bold text-center">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.map(p => {
                    const cat = categories.find(c => c.id === p.categoryId);
                    const isLow = p.trackInventory && p.stock > 0 && p.stock <= p.lowStockThreshold;
                    const isOut = p.trackInventory && p.stock <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{p.sku}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{cat?.name || 'Uncategorized'}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-sm">
                          {!p.trackInventory ? '∞' : p.stock}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">{p.lowStockThreshold}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">${p.cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">${p.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !p.trackInventory
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                : isOut
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                : isLow
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                          >
                            {!p.trackInventory ? 'Untracked' : isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Movements Audit Ledger */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search ledger by product, SKU, or reason..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <select
                value={filterMovementType}
                onChange={e => setFilterMovementType(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Movement Types</option>
                <option value="sale">Sales</option>
                <option value="refund">Refunds</option>
                <option value="adjustment">Manual Adjustments</option>
                <option value="purchase">PO Receipts</option>
                <option value="count">Count Reconciliations</option>
                <option value="damaged">Damaged / Waste</option>
              </select>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Date & Time</th>
                    <th className="px-4 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 font-bold">Type</th>
                    <th className="px-4 py-3 font-bold text-right">Delta Qty</th>
                    <th className="px-4 py-3 font-bold text-right">New Balance</th>
                    <th className="px-4 py-3 font-bold">Reason / Reference</th>
                    <th className="px-4 py-3 font-bold">Staff Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 dark:text-white block">{m.productName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{m.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                          {m.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span className={m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {m.newQuantity}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{m.reason}</td>
                      <td className="px-4 py-3 text-slate-500">{m.employeeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Physical Stock Counts */}
        {activeTab === 'counts' && (
          <div className="space-y-4">
            {activeCountSession ? (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-600" />
                      <span>{activeCountSession.title}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter the actual counted shelf units. System automatically calculates variances.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveCountSession(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCommitPhysicalCount}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Commit & Reconcile</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3 font-bold">Product Name</th>
                        <th className="px-4 py-3 font-bold">SKU</th>
                        <th className="px-4 py-3 font-bold text-right">System Expected</th>
                        <th className="px-4 py-3 font-bold text-right w-32">Actual Counted</th>
                        <th className="px-4 py-3 font-bold text-right">Variance Units</th>
                        <th className="px-4 py-3 font-bold text-right">Variance Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeCountSession.items.map((item, idx) => {
                        const variance = item.countedStock - item.systemExpectedStock;
                        const varianceVal = variance * item.unitCost;

                        return (
                          <tr key={item.productId} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                              {item.productName}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400">{item.sku}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-600 dark:text-slate-300">
                              {item.systemExpectedStock}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.countedStock}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setActiveCountSession(prev => {
                                    if (!prev) return null;
                                    const nextItems = [...prev.items];
                                    nextItems[idx] = { ...item, countedStock: val };
                                    return { ...prev, items: nextItems };
                                  });
                                }}
                                className="w-24 text-right px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold">
                              <span
                                className={
                                  variance > 0
                                    ? 'text-emerald-600'
                                    : variance < 0
                                    ? 'text-rose-600'
                                    : 'text-slate-400'
                                }
                              >
                                {variance > 0 ? `+${variance}` : variance}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold">
                              <span
                                className={
                                  varianceVal > 0
                                    ? 'text-emerald-600'
                                    : varianceVal < 0
                                    ? 'text-rose-600'
                                    : 'text-slate-400'
                                }
                              >
                                {varianceVal > 0 ? '+' : ''}${varianceVal.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Session Title</th>
                      <th className="px-4 py-3 font-bold">Date Started</th>
                      <th className="px-4 py-3 font-bold">Auditor</th>
                      <th className="px-4 py-3 font-bold text-right">Items Audited</th>
                      <th className="px-4 py-3 font-bold text-right">Net Variance Units</th>
                      <th className="px-4 py-3 font-bold text-right">Net Variance Value</th>
                      <th className="px-4 py-3 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stockCounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No physical stock count sessions recorded. Click "Start New Count" to audit stock.
                        </td>
                      </tr>
                    ) : (
                      stockCounts.map(sc => (
                        <tr key={sc.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{sc.title}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                            {new Date(sc.startedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{sc.conductedBy}</td>
                          <td className="px-4 py-3 text-right font-mono">{sc.items.length}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            <span
                              className={
                                sc.totalVarianceUnits > 0
                                  ? 'text-emerald-600'
                                  : sc.totalVarianceUnits < 0
                                  ? 'text-rose-600'
                                  : 'text-slate-400'
                              }
                            >
                              {sc.totalVarianceUnits > 0 ? `+${sc.totalVarianceUnits}` : sc.totalVarianceUnits}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            ${sc.totalVarianceValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sc.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {sc.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Suppliers & Purchase Orders */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            {/* Purchase Orders List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Purchase Orders (POs)</span>
                </h3>
                <span className="text-xs text-slate-500">{purchaseOrders.length} Orders</span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">PO Number</th>
                    <th className="px-4 py-3 font-bold">Supplier</th>
                    <th className="px-4 py-3 font-bold">Date Issued</th>
                    <th className="px-4 py-3 font-bold text-right">Items</th>
                    <th className="px-4 py-3 font-bold text-right">Total Amount</th>
                    <th className="px-4 py-3 font-bold text-center">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No purchase orders created. Click "Create PO" to issue a restock order.
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map(po => (
                      <tr key={po.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold font-mono text-slate-900 dark:text-white">{po.poNumber}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{po.supplierName}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {new Date(po.orderDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{po.items.length}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">${po.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.status === 'received'
                                ? 'bg-emerald-100 text-emerald-800'
                                : po.status === 'ordered'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {po.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {po.status === 'ordered' && (
                            <button
                              onClick={() => handleReceivePO(po.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Receive Goods
                            </button>
                          )}
                          {po.status === 'received' && (
                            <span className="text-[11px] text-slate-400 font-medium">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Suppliers Directory */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-600" />
                  <span>Approved Suppliers Directory</span>
                </h3>
                <span className="text-xs text-slate-500">{suppliers.length} Suppliers</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                {suppliers.length === 0 ? (
                  <p className="col-span-3 text-xs text-slate-500 text-center py-6">
                    No suppliers added yet. Click "New Supplier" to register distributors.
                  </p>
                ) : (
                  suppliers.map(sup => (
                    <div
                      key={sup.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{sup.name}</h4>
                      <p className="text-slate-500">Contact: {sup.contactPerson || 'N/A'}</p>
                      <p className="text-slate-500">Email: {sup.email || 'N/A'}</p>
                      <p className="text-slate-500">Phone: {sup.phone || 'N/A'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Quick Stock Adjustment */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Adjust Stock: {adjustingProduct.name}</h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['add', 'remove', 'set'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAdjType(type)}
                      className={`py-2 rounded-xl text-xs font-bold capitalize border cursor-pointer ${
                        adjType === type
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      {type === 'add' ? '+ Add' : type === 'remove' ? '- Reduce' : '= Set Qty'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={adjQuantity}
                  onChange={e => setAdjQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Reason</label>
                <select
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="Purchase / Restock">Purchase / Restock</option>
                  <option value="Damaged / Expired">Damaged / Expired</option>
                  <option value="Inventory Audit Count">Inventory Audit Count</option>
                  <option value="Transfer / Other">Transfer / Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Register New Supplier</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Company / Supplier Name</label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  placeholder="e.g. Acme Coffee Roasters"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={newSupplierContact}
                  onChange={e => setNewSupplierContact(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={e => setNewSupplierEmail(e.target.value)}
                  placeholder="orders@acmecoffee.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newSupplierPhone}
                  onChange={e => setNewSupplierPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Purchase Order */}
      {showCreatePOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Create Purchase Order (PO)</h3>
              <button onClick={() => setShowCreatePOModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Select Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">Order Line Items</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (products.length > 0) {
                        setPoItems(prev => [...prev, { productId: products[0].id, qty: 10, cost: products[0].cost }]);
                      }
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    + Add Product
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl text-xs">
                      <select
                        value={item.productId}
                        onChange={e => {
                          const pId = e.target.value;
                          const p = products.find(prod => prod.id === pId);
                          setPoItems(prev => {
                            const next = [...prev];
                            next[idx] = { ...item, productId: pId, cost: p?.cost || 0 };
                            return next;
                          });
                        }}
                        className="flex-1 px-2 py-1 bg-white dark:bg-slate-700 rounded-lg text-xs"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (${p.cost.toFixed(2)})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={e => {
                          const q = parseInt(e.target.value, 10) || 1;
                          setPoItems(prev => {
                            const next = [...prev];
                            next[idx] = { ...item, qty: q };
                            return next;
                          });
                        }}
                        className="w-16 px-2 py-1 bg-white dark:bg-slate-700 rounded-lg text-xs font-mono"
                      />

                      <button
                        type="button"
                        onClick={() => setPoItems(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePOModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
