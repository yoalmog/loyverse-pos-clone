import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import {
  Printer,
  PrinterRoute,
  PrintJob,
  PrinterPurpose
} from '../../types/printer.ts';
import { PrintService } from '../../services/printer/printService.ts';
import { StorageService } from '../../services/storageService.ts';
import { BluetoothPrinterService } from '../../services/printer/bluetoothPrinterService.ts';
import { AddPrinterModal } from './AddPrinterModal.tsx';
import { IframeBluetoothHelperModal } from './IframeBluetoothHelperModal.tsx';
import {
  Printer as PrinterIcon,
  Plus,
  Wifi,
  Bluetooth,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RefreshCw,
  Trash2,
  Edit,
  Route as RouteIcon,
  FileText,
  ListOrdered,
  Activity,
  DollarSign,
  QrCode,
  Barcode,
  Power
} from 'lucide-react';

export const PrintersManagementView: React.FC = () => {
  const { showToast, categories, products, settings, updateSettings, isOwner, requireOwnerAuth, t } = usePOS();

  // Tabs: Printers, Routing, Receipt, Print Queue, Diagnostics
  const [activeTab, setActiveTab] = useState<'printers' | 'routing' | 'receipt' | 'queue' | 'diagnostics'>('printers');

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [routes, setRoutes] = useState<PrinterRoute[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);

  // Testing states
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  // New Route Form
  const [newRouteType, setNewRouteType] = useState<'category' | 'product'>('category');
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [selectedProdId, setSelectedProdId] = useState<string>(products[0]?.id || '');
  const [selectedRoutePrinterId, setSelectedRoutePrinterId] = useState<string>('');
  const [selectedRoutePurpose, setSelectedRoutePurpose] = useState<PrinterPurpose>('kitchen');

  const loadData = () => {
    setPrinters(PrintService.getPrinters());
    setRoutes(PrintService.getRoutes());
    setJobs(PrintService.getPrintJobs());
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (printers.length > 0 && !selectedRoutePrinterId) {
      setSelectedRoutePrinterId(printers[0].id);
    }
  }, [printers, selectedRoutePrinterId]);

  // Actions
  const handleTestConnection = async (printerId: string) => {
    setTestingPrinterId(printerId);
    const res = await PrintService.testConnection(printerId);
    loadData();
    setTestingPrinterId(null);
    showToast({
      type: res.success ? 'success' : 'error',
      title: res.success ? 'Printer Reachable' : 'Connection Failed',
      message: res.message
    });
  };

  const handleTestPrint = async (printerId: string) => {
    setTestingPrinterId(printerId);
    const res = await PrintService.testPrint(printerId);
    loadData();
    setTestingPrinterId(null);
    showToast({
      type: res.success ? 'success' : 'error',
      title: res.success ? 'Test Print Dispatched' : 'Print Failed',
      message: res.message
    });
  };

  const [isScanningBluetooth, setIsScanningBluetooth] = useState<boolean>(false);
  const [isIframeHelperOpen, setIsIframeHelperOpen] = useState<boolean>(false);

  const handleScanBluetooth = async () => {
    setIsScanningBluetooth(true);
    try {
      const res = await BluetoothPrinterService.scanAndPair();
      if (res.success && res.printer) {
        const newPrinter: Printer = {
          id: `prn_bt_${Date.now()}`,
          storeId: settings.id || 'store_aura_main',
          name: res.printer.name || 'Bluetooth Printer',
          model: res.printer.protocol || 'ESC/POS Bluetooth Thermal',
          printerType: 'x18',
          connectionType: 'bluetooth',
          deviceIdentifier: res.printer.id,
          paperWidth: res.printer.paperWidth || 58,
          charactersPerLine: res.printer.paperWidth === 80 ? 48 : 32,
          encoding: 'CP437',
          isDefault: printers.length === 0,
          printerPurpose: 'receipt',
          autoPrint: true,
          supportsCut: false,
          supportsCashDrawer: false,
          supportsQr: true,
          supportsBarcode: true,
          status: 'connected',
          lastCheckedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        PrintService.savePrinter(newPrinter);
        loadData();
        showToast({
          type: 'success',
          title: t('printers.bluetoothPaired', 'Bluetooth Printer Paired'),
          message: `${newPrinter.name} successfully paired and connected.`
        });
      } else if (res.isSecurityBlocked) {
        setIsIframeHelperOpen(true);
      } else if (res.error) {
        showToast({
          type: 'warning',
          title: t('printers.scanNotice', 'Bluetooth Notice'),
          message: res.error
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Bluetooth Scan Error',
        message: err.message || 'Bluetooth connection failed.'
      });
    } finally {
      setIsScanningBluetooth(false);
    }
  };

  const handleDeletePrinter = (printer: Printer) => {
    requireOwnerAuth(() => {
      if (confirm(`Delete printer "${printer.name}"? All assigned routes will be removed.`)) {
        PrintService.deletePrinter(printer.id);
        loadData();
        showToast({ type: 'info', title: 'Printer Deleted' });
      }
    }, 'Delete Hardware Printer');
  };

  const handleAddRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoutePrinterId) {
      showToast({ type: 'warning', title: 'Select a printer first' });
      return;
    }

    requireOwnerAuth(() => {
      const newRoute: PrinterRoute = {
        id: `route_${Date.now()}`,
        storeId: 'store_aura_main',
        printerId: selectedRoutePrinterId,
        categoryId: newRouteType === 'category' ? selectedCatId : undefined,
        productId: newRouteType === 'product' ? selectedProdId : undefined,
        purpose: selectedRoutePurpose,
        priority: newRouteType === 'product' ? 20 : 10,
        autoPrint: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      PrintService.saveRoute(newRoute);
      loadData();
      showToast({ type: 'success', title: 'Routing Rule Created' });
    }, 'Create Printer Routing Rule');
  };

  const handleDeleteRoute = (id: string) => {
    requireOwnerAuth(() => {
      PrintService.deleteRoute(id);
      loadData();
      showToast({ type: 'info', title: 'Routing Rule Removed' });
    }, 'Remove Printer Route');
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    const success = await PrintService.retryJob(jobId);
    loadData();
    setRetryingJobId(null);
    showToast({
      type: success ? 'success' : 'error',
      title: success ? 'Job Succeeded' : 'Retry Failed',
      message: success ? 'Print job completed.' : 'Could not reach target printer.'
    });
  };

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Add Printer Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PrinterIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Printers & Hardware Management</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dual thermal printer infrastructure: X18 Mini Bluetooth portable + Generic LAN ESC/POS network printers (TCP 9100)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleScanBluetooth}
              disabled={isScanningBluetooth}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
            >
              <Bluetooth className={`w-4 h-4 ${isScanningBluetooth ? 'animate-spin' : ''}`} />
              <span>{isScanningBluetooth ? 'Scanning...' : 'Scan Bluetooth Printers'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingPrinter(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Printer</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Section 30) */}
        <div className="flex border-b border-slate-200 gap-4 sm:gap-8 text-xs font-semibold overflow-x-auto scrollbar-none">
          {[
            { id: 'printers', label: 'Configured Printers', icon: PrinterIcon, count: printers.length },
            { id: 'routing', label: 'Ticket Routing', icon: RouteIcon, count: routes.length },
            { id: 'receipt', label: 'Receipt Options', icon: FileText },
            { id: 'queue', label: 'Print Spooler Queue', icon: ListOrdered, count: jobs.filter(j => j.status === 'failed' || j.status === 'printing').length },
            { id: 'diagnostics', label: 'Network Diagnostics', icon: Activity }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  isSelected
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      tab.id === 'queue' && jobs.some(j => j.status === 'failed')
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: PRINTERS CARDS (Section 16 & 30) */}
        {activeTab === 'printers' && (
          <div className="space-y-4">
            {printers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                  <Bluetooth className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">No printers configured</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Add a printer to start printing receipts.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleScanBluetooth}
                    disabled={isScanningBluetooth}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Bluetooth className={`w-4 h-4 ${isScanningBluetooth ? 'animate-spin' : ''}`} />
                    <span>{isScanningBluetooth ? 'Scanning...' : 'Scan Bluetooth Printers'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrinter(null);
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    <Wifi className="w-4 h-4" />
                    <span>Add LAN Printer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrinter(null);
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add USB Printer</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {printers.map(p => {
                const isOnline = p.status === 'online' || p.status === 'ready';
                const isTesting = testingPrinterId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                      isOnline ? 'border-slate-200 hover:border-slate-300' : 'border-rose-200 bg-rose-50/20'
                    }`}
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          {p.connectionType === 'lan' ? (
                            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Wifi className="w-4 h-4" />
                            </span>
                          ) : p.connectionType === 'bluetooth' ? (
                            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                              <Bluetooth className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                              <Monitor className="w-4 h-4" />
                            </span>
                          )}

                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {p.printerPurpose}
                          </span>
                          {p.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">
                              Default
                            </span>
                          )}
                        </div>

                        {/* Online/Offline status badge */}
                        <span
                          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            isOnline
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{isOnline ? 'Online' : 'Offline'}</span>
                        </span>
                      </div>

                      {/* Printer Identity */}
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{p.model}</p>

                      {/* Technical specifications */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                        {p.connectionType === 'lan' && (
                          <div className="flex justify-between">
                            <span>TCP IP:</span>
                            <span className="font-bold text-slate-800">{p.ipAddress}:{p.port || 9100}</span>
                          </div>
                        )}
                        {p.connectionType === 'bluetooth' && (
                          <div className="flex justify-between">
                            <span>BLE Tag:</span>
                            <span className="font-bold text-slate-800">{p.deviceIdentifier || 'X18-BLE'}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Paper / Cols:</span>
                          <span>{p.paperWidth}mm ({p.charactersPerLine} cols)</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Auto Cut:</span>
                          <span>{p.supportsCut ? 'Yes' : 'No'}</span>
                        </div>
                      </div>

                      {p.lastError && (
                        <p className="mt-2 text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-200 leading-tight">
                          {p.lastError}
                        </p>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between gap-1">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={isTesting}
                          onClick={() => handleTestConnection(p.id)}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
                          title="Ping connection"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                          <span>Test</span>
                        </button>

                        <button
                          type="button"
                          disabled={isTesting}
                          onClick={() => handleTestPrint(p.id)}
                          className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
                          title="Print test receipt"
                        >
                          <Play className="w-3 h-3" />
                          <span>Print</span>
                        </button>
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPrinter(p);
                            setIsAddModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePrinter(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* TAB 2: TICKET ROUTING (Section 17 & 18) */}
        {activeTab === 'routing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Add Category or Product Routing Rule</h3>
              <p className="text-xs text-slate-500">
                Direct food orders to the Kitchen ESC/POS printer, drink orders to the Barista station, and customer receipts to the X18 Mini.
              </p>

              <form onSubmit={handleAddRoute} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Route Target</label>
                  <select
                    value={newRouteType}
                    onChange={e => setNewRouteType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-medium"
                  >
                    <option value="category">Product Category</option>
                    <option value="product">Specific Product Item</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Item / Category</label>
                  {newRouteType === 'category' ? (
                    <select
                      value={selectedCatId}
                      onChange={e => setSelectedCatId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-medium"
                    >
                      {categories.filter(c => c.id !== 'cat_all' && c.id !== 'cat_fav').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={selectedProdId}
                      onChange={e => setSelectedProdId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-medium"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Printer</label>
                  <select
                    value={selectedRoutePrinterId}
                    onChange={e => setSelectedRoutePrinterId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-semibold"
                  >
                    {printers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.printerPurpose})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                  >
                    + Add Route Rule
                  </button>
                </div>
              </form>
            </div>

            {/* Active Routing Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-900 bg-slate-50">
                Active Print Routing Rules (Priority Order)
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {routes.map(r => {
                  const targetPrinter = printers.find(p => p.id === r.printerId);
                  const cat = categories.find(c => c.id === r.categoryId);
                  const prod = products.find(p => p.id === r.productId);

                  return (
                    <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          {r.priority >= 20 ? 'P' : 'C'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {prod ? `Product: ${prod.name}` : cat ? `Category: ${cat.name}` : `Purpose: ${r.purpose}`}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Priority: {r.priority} · Auto-Print: {r.autoPrint ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">{targetPrinter?.name || 'Unknown Printer'}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{targetPrinter?.printerType} ({targetPrinter?.connectionType})</p>
                        </div>
                        <button
                          onClick={() => handleDeleteRoute(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RECEIPT CUSTOMIZER (Section 12, 13, 14, 15, 34) */}
        {activeTab === 'receipt' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Global Thermal Receipt & Cash Drawer Options</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Header Text</label>
                <input
                  type="text"
                  value={settings.receiptHeader || ''}
                  onChange={e => updateSettings({ ...settings, receiptHeader: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Footer Note</label>
                <input
                  type="text"
                  value={settings.receiptFooter || ''}
                  onChange={e => updateSettings({ ...settings, receiptFooter: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            {/* Hardware Commands Toggles (Sections 12, 13, 14, 15) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">ESC/POS Hardware Triggers</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showBarcode ?? true}
                    onChange={e => updateSettings({ ...settings, showBarcode: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Print CODE128 Receipt Barcode</span>
                    <span className="text-[11px] text-slate-500">Allows barcode scanner lookup for speedy customer returns and exchanges.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showLoyalty ?? true}
                    onChange={e => updateSettings({ ...settings, showLoyalty: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Print QR Code Verification</span>
                    <span className="text-[11px] text-slate-500">Prints digital receipt URL or loyalty rewards QR code on thermal receipts.</span>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] flex items-start gap-2">
                <DollarSign className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Cash Drawer Kick Policy (Section 15):</strong> The system automatically fires the ESC/POS cash drawer pulse command (0x1B 0x70) upon completing cash payments on compatible printers. Cash drawers remain safely closed for credit card or mobile tap transactions.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PRINT SPOOLER QUEUE (Section 22 & 33) */}
        {activeTab === 'queue' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="font-bold text-xs text-slate-900">
                Print Spooler Job Queue ({jobs.length} jobs)
              </div>
              <button
                onClick={() => {
                  StorageService.savePrintJobs([]);
                  loadData();
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear History
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No active or historical print jobs in queue.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
                {jobs.map(job => (
                  <div key={job.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          job.status === 'completed'
                            ? 'bg-emerald-500'
                            : job.status === 'printing'
                            ? 'bg-blue-500 animate-pulse'
                            : job.status === 'queued'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{job.title}</p>
                          <span className="text-[10px] uppercase font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {job.jobType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Printer: {job.printerName} · {new Date(job.createdAt).toLocaleTimeString()}
                        </p>
                        {job.errorMessage && (
                          <p className="text-[11px] text-rose-600 mt-0.5">{job.errorMessage}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          job.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : job.status === 'printing'
                            ? 'bg-blue-100 text-blue-800'
                            : job.status === 'queued'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {job.status}
                      </span>

                      {job.status === 'failed' && (
                        <button
                          type="button"
                          disabled={retryingJobId === job.id}
                          onClick={() => handleRetryJob(job.id)}
                          className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${retryingJobId === job.id ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DIAGNOSTICS (Section 31) */}
        {activeTab === 'diagnostics' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-900 bg-slate-50">
              Technical Printer Diagnostics & Telemetry
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {printers.map(p => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{p.name}</h4>
                      <p className="text-[11px] text-slate-500">{p.model}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestConnection(p.id)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                      >
                        Test Connection
                      </button>
                      <button
                        onClick={() => handleTestPrint(p.id)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white"
                      >
                        Test Print
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">INTERFACE:</span>
                      <span className="font-bold">{p.connectionType.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ADDRESS / PORT:</span>
                      <span className="font-bold">{p.ipAddress ? `${p.ipAddress}:${p.port || 9100}` : p.deviceIdentifier || 'Local'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">PAPER SPECS:</span>
                      <span>{p.paperWidth}mm / {p.charactersPerLine} cols</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ENCODING:</span>
                      <span>{p.encoding}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Printer Modal */}
      <AddPrinterModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPrinter(null);
        }}
        onPrinterAdded={() => {
          loadData();
          showToast({ type: 'success', title: 'Printer Saved' });
        }}
        editingPrinter={editingPrinter}
      />

      {/* Iframe Bluetooth Helper Modal */}
      <IframeBluetoothHelperModal
        isOpen={isIframeHelperOpen}
        onClose={() => setIsIframeHelperOpen(false)}
        onSelectLan={() => {
          setIsIframeHelperOpen(false);
          setEditingPrinter(null);
          setIsAddModalOpen(true);
        }}
      />
    </div>
  );
};
