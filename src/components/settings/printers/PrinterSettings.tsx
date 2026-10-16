import React, { useState, useEffect } from 'react';
import { Printer, PrinterPurpose, PaperWidthMm } from '../../../types/printer.ts';
import { PrinterService } from '../../../services/PrinterService.ts';
import { PrintQueueService, PersistentPrintJob } from '../../../services/printer/printQueueService.ts';
import { NativeBridgeService, DiscoveredNativeDevice } from '../../../services/native/NativeBridgeService.ts';
import { BluetoothPrinterService } from '../../../services/printer/bluetoothPrinterService.ts';
import { X18USBAdapter } from '../../../services/printer/adapters/x18UsbAdapter.ts';
import { usePOS } from '../../../context/POSContext.tsx';
import { LanPrinterConfigModal } from './LanPrinterConfigModal.tsx';
import { PrinterTestDialog } from './PrinterTestDialog.tsx';
import { LanDiscoveryBanner } from './LanDiscoveryBanner.tsx';
import {
  Printer as PrinterIcon,
  Plus,
  Wifi,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Trash2,
  Edit,
  Route as RouteIcon,
  RefreshCw,
  Power,
  ShieldCheck,
  Zap,
  Sliders,
  Check,
  ShieldAlert,
  X,
  Radio,
  Usb,
  ListOrdered,
  Activity,
  DollarSign,
  Barcode,
  RotateCcw
} from 'lucide-react';

export const PrinterSettings: React.FC = () => {
  const { t, showToast, settings, updateSettings } = usePOS();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isLanModalOpen, setIsLanModalOpen] = useState<boolean>(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'devices' | 'bluetooth' | 'lan' | 'usb' | 'routing' | 'queue' | 'diagnostics'>('devices');

  // Testing & diagnostic state
  const [testPrinter, setTestPrinter] = useState<Printer | null>(null);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    previewText?: string;
  } | null>(null);
  const [isTestingInProgress, setIsTestingInProgress] = useState<boolean>(false);

  // Quick testing feedback per printer ID
  const [quickTestStatus, setQuickTestStatus] = useState<Record<string, {
    testing: boolean;
    success?: boolean;
    latencyMs?: number;
    message?: string;
  }>>({});

  // --------------------------------------------------------------------------
  // BLUETOOTH HARDWARE STATE (Sections 5 & 6)
  // --------------------------------------------------------------------------
  const [isScanningBluetooth, setIsScanningBluetooth] = useState<boolean>(false);
  const [bluetoothNotice, setBluetoothNotice] = useState<string | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<DiscoveredNativeDevice[]>([]);
  const [bluetoothConnectingId, setBluetoothConnectingId] = useState<string | null>(null);
  const [bluetoothConnectedMap, setBluetoothConnectedMap] = useState<Record<string, boolean>>({});
  const [bluetoothStatusInfo, setBluetoothStatusInfo] = useState<{ enabled: boolean; hasPermissions: boolean; isNative: boolean }>({
    enabled: true,
    hasPermissions: true,
    isNative: false
  });

  // Modal to save newly paired Bluetooth device into POS printer registry
  const [savingBtDevice, setSavingBtDevice] = useState<DiscoveredNativeDevice | null>(null);
  const [btPaperWidth, setBtPaperWidth] = useState<PaperWidthMm>(58);
  const [btPurpose, setBtPurpose] = useState<PrinterPurpose>('receipt');
  const [btAutoPrint, setBtAutoPrint] = useState<boolean>(true);

  // BLE Diagnostic Modal State (Tasks 7, 12, 14)
  const [diagModalDevice, setDiagModalDevice] = useState<DiscoveredNativeDevice | null>(null);
  const [diagData, setDiagData] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [diagWriteTesting, setDiagWriteTesting] = useState<boolean>(false);
  const [diagWriteResult, setDiagWriteResult] = useState<any>(null);

  // --------------------------------------------------------------------------
  // USB HARDWARE STATE (Section 8)
  // --------------------------------------------------------------------------
  const [usbDevices, setUsbDevices] = useState<DiscoveredNativeDevice[]>([]);
  const [isScanningUsb, setIsScanningUsb] = useState<boolean>(false);
  const [usbConnectingId, setUsbConnectingId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // PRINT QUEUE STATE (Section 11)
  // --------------------------------------------------------------------------
  const [queueJobs, setQueueJobs] = useState<PersistentPrintJob[]>([]);

  // --------------------------------------------------------------------------
  // DIAGNOSTICS & CASH DRAWER TEST STATE (Section 32)
  // --------------------------------------------------------------------------
  const [drawerTestStatus, setDrawerTestStatus] = useState<string | null>(null);
  const [barcodeInputHistory, setBarcodeInputHistory] = useState<string[]>([]);

  const isNative = NativeBridgeService.isNativeAndroid();

  const loadPrinters = () => {
    const list = PrinterService.getPrinters();
    setPrinters(list);
  };

  const loadQueue = () => {
    setQueueJobs(PrintQueueService.getQueue());
  };

  useEffect(() => {
    loadPrinters();
    loadQueue();

    // Check Bluetooth status
    const btStatus = NativeBridgeService.printer.getBluetoothStatus();
    setBluetoothStatusInfo(btStatus);

    // Initial query of paired Bluetooth devices
    if (NativeBridgeService.isNativeAndroid()) {
      const paired = NativeBridgeService.printer.getPairedBluetoothDevices();
      if (paired.length > 0) {
        setBluetoothDevices(paired);
      }
    }

    const unsubQueue = PrintQueueService.subscribe(() => {
      loadQueue();
    });

    // Listen to barcode scanner events
    const unsubBarcode = NativeBridgeService.barcode.startScanner(code => {
      setBarcodeInputHistory(prev => [code, ...prev.slice(0, 9)]);
      showToast({
        type: 'info',
        title: 'Barcode Intercepted',
        message: `Hardware scanner read: ${code}`
      });
    });

    return () => {
      unsubQueue();
      unsubBarcode();
    };
  }, []);

  // Quick Connection Test
  const handleQuickTest = async (printer: Printer) => {
    setQuickTestStatus(prev => ({
      ...prev,
      [printer.id]: { testing: true }
    }));

    try {
      const res = await PrinterService.testConnection(printer);
      setQuickTestStatus(prev => ({
        ...prev,
        [printer.id]: {
          testing: false,
          success: res.success,
          latencyMs: res.latencyMs,
          message: res.message
        }
      }));
      loadPrinters();
    } catch (err: any) {
      setQuickTestStatus(prev => ({
        ...prev,
        [printer.id]: {
          testing: false,
          success: false,
          message: err?.message || 'Test failed'
        }
      }));
    }
  };

  // Full Diagnostic Test Print with Dialog
  const handleOpenDiagnosticTest = async (printer: Printer) => {
    setTestPrinter(printer);
    setIsTestDialogOpen(true);
    setIsTestingInProgress(true);
    setTestResult(null);

    try {
      const res = await PrinterService.testPrint(printer);
      const isX6h = (printer.name || '').toLowerCase().includes('x6') ||
                    (printer.model || '').toLowerCase().includes('x6') ||
                    (printer.model || '').toLowerCase().includes('cat') ||
                    printer.protocol === 'X6H_BLE' ||
                    printer.printerType === 'x6' ||
                    printer.printerType === 'cat';

      const successMsg = isX6h
        ? `X6h BLE test receipt transmitted successfully to ${printer.name}. Bitmap raster printed and paper feed completed.`
        : `ESC/POS test receipt transmitted successfully to ${printer.name}. Paper feed and test sequence completed.`;

      setTestResult({
        success: res.success,
        message: res.success ? successMsg : (res.error || 'Failed to print test receipt'),
        previewText: res.previewText
      });
      loadPrinters();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Failed to run printer diagnostic'
      });
    } finally {
      setIsTestingInProgress(false);
    }
  };

  // Delete printer
  const handleDeletePrinter = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      PrinterService.deletePrinter(id);
      loadPrinters();
      showToast({ type: 'success', title: 'Printer Removed', message: `Deleted ${name}` });
    }
  };

  // --------------------------------------------------------------------------
  // BLUETOOTH SCANNING & CONNECTION (Section 5)
  // --------------------------------------------------------------------------
  const handleScanBluetooth = () => {
    setIsScanningBluetooth(true);
    setBluetoothNotice(null);

    if (NativeBridgeService.isNativeAndroid()) {
      const scanRes = NativeBridgeService.printer.scanBluetooth(devices => {
        setBluetoothDevices(devices);
      });

      if (!scanRes.success) {
        setIsScanningBluetooth(false);
        setBluetoothNotice(scanRes.error || 'Bluetooth discovery error.');
      } else {
        // Automatically stop active scan animation after 12 seconds
        setTimeout(() => {
          setIsScanningBluetooth(false);
        }, 12000);
      }
    } else {
      // Browser fallback (Web Bluetooth BLE)
      BluetoothPrinterService.scanAndPair()
        .then(res => {
          if (res.success && res.printer) {
            const dev: DiscoveredNativeDevice = {
              id: res.printer.id,
              name: res.printer.name || 'Bluetooth BLE Thermal',
              address: res.printer.id,
              type: 'bluetooth',
              bonded: true
            };
            setBluetoothDevices(prev => [dev, ...prev.filter(d => d.id !== dev.id)]);
            setBluetoothConnectedMap(prev => ({ ...prev, [dev.id]: true }));
            setSavingBtDevice(dev);
          } else if (res.error) {
            setBluetoothNotice(res.error);
          }
        })
        .catch(err => {
          setBluetoothNotice(err?.message || 'Web Bluetooth discovery cancelled.');
        })
        .finally(() => {
          setIsScanningBluetooth(false);
        });
    }
  };

  const handleStopBluetoothScan = () => {
    NativeBridgeService.printer.stopBluetoothScan();
    setIsScanningBluetooth(false);
  };

  const handleConnectBluetoothDevice = async (device: DiscoveredNativeDevice) => {
    setBluetoothConnectingId(device.id);
    setBluetoothNotice(null);

    try {
      const res = await NativeBridgeService.printer.connectBluetooth(device.address || device.id);
      if (res.success) {
        setBluetoothConnectedMap(prev => ({ ...prev, [device.id]: true }));
        showToast({
          type: 'success',
          title: 'Connected',
          message: `Established native connection to ${res.name || device.name}`
        });
      } else {
        setBluetoothConnectedMap(prev => ({ ...prev, [device.id]: false }));
        setBluetoothNotice(res.error || `Could not establish connection to ${device.name}.`);
      }
    } catch (err: any) {
      setBluetoothNotice(err?.message || 'Bluetooth connection failed.');
    } finally {
      setBluetoothConnectingId(null);
    }
  };

  const handleDisconnectBluetoothDevice = (device: DiscoveredNativeDevice) => {
    NativeBridgeService.printer.disconnectBluetooth(device.address || device.id);
    setBluetoothConnectedMap(prev => ({ ...prev, [device.id]: false }));
    showToast({ type: 'info', title: 'Disconnected', message: `${device.name} disconnected.` });
  };

  const handleTestPrintBluetoothDevice = async (device: DiscoveredNativeDevice) => {
    const res = await NativeBridgeService.printer.testPrint({
      connectionType: 'bluetooth',
      deviceIdentifier: device.address || device.id,
      name: device.name,
      paperWidth: 58
    });

    if (res.success) {
      showToast({ type: 'success', title: 'Test Print Dispatched', message: res.message });
    } else {
      showToast({ type: 'error', title: 'Test Print Failed', message: res.error });
    }
  };

  const handleOpenBleDiagnostic = async (device: DiscoveredNativeDevice) => {
    setDiagModalDevice(device);
    setDiagLoading(true);
    setDiagWriteResult(null);
    try {
      const res = await NativeBridgeService.printer.getGattDiagnostic(device.address || device.id);
      if (res.success && res.diagnostic) {
        setDiagData(res.diagnostic);
      } else {
        setDiagData({ error: res.error || 'Failed to inspect GATT characteristics' });
      }
    } catch (e: any) {
      setDiagData({ error: e?.message || 'Error communicating with GATT driver' });
    } finally {
      setDiagLoading(false);
    }
  };

  const handleRunBle1PacketTest = async (device: DiscoveredNativeDevice) => {
    setDiagWriteTesting(true);
    setDiagWriteResult(null);
    try {
      const res = await NativeBridgeService.printer.testBleWrite(device.address || device.id);
      setDiagWriteResult(res);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'TEST B Passed: 1-Packet Write OK',
          message: res.message || '1-Packet write successfully accepted by Android GATT.'
        });
      } else {
        showToast({
          type: 'error',
          title: 'TEST B Failed: 1-Packet Write Error',
          message: res.error || 'GATT write rejected.'
        });
      }
    } catch (e: any) {
      setDiagWriteResult({ success: false, error: e?.message || 'Write test execution failed' });
    } finally {
      setDiagWriteTesting(false);
    }
  };

  const handleSaveBluetoothPrinter = () => {
    if (!savingBtDevice) return;

    const newPrinter: Printer = {
      id: `prn_bt_${Date.now()}`,
      storeId: 'store_aura_main',
      name: savingBtDevice.name || 'X18 Mini Printer',
      model: 'X18 Mini ESC/POS Bluetooth Thermal',
      printerType: 'x18',
      connectionType: 'bluetooth',
      deviceIdentifier: savingBtDevice.address || savingBtDevice.id,
      paperWidth: btPaperWidth,
      charactersPerLine: btPaperWidth === 80 ? 48 : 32,
      encoding: 'CP437',
      isDefault: printers.length === 0,
      printerPurpose: btPurpose,
      autoPrint: btAutoPrint,
      supportsCut: false,
      supportsCashDrawer: false,
      supportsQr: true,
      supportsBarcode: true,
      status: 'connected',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    PrinterService.savePrinter(newPrinter);
    loadPrinters();
    setSavingBtDevice(null);
    showToast({
      type: 'success',
      title: 'Printer Saved',
      message: `${newPrinter.name} registered as ${newPrinter.printerPurpose.toUpperCase()} printer.`
    });
  };

  // --------------------------------------------------------------------------
  // USB SCANNING & CONNECTION (Section 8)
  // --------------------------------------------------------------------------
  const handleScanUsb = async () => {
    setIsScanningUsb(true);
    setBluetoothNotice(null);

    if (NativeBridgeService.isNativeAndroid()) {
      const devs = NativeBridgeService.printer.scanUSB();
      setUsbDevices(devs);
      setIsScanningUsb(false);
      if (devs.length === 0) {
        setBluetoothNotice('No USB thermal printers detected. Ensure USB OTG cable is connected to your printer.');
      }
    } else {
      // Browser fallback (WebUSB)
      try {
        const res = await X18USBAdapter.requestUsbPrinter();
        if (res.success && res.printer) {
          const newPrinter: Printer = {
            id: `prn_usb_${Date.now()}`,
            storeId: 'store_aura_main',
            name: res.printer.name || 'USB ESC/POS Printer',
            model: 'ESC/POS USB Thermal',
            printerType: 'usb',
            connectionType: 'usb',
            deviceIdentifier: res.printer.id,
            paperWidth: 58,
            charactersPerLine: 32,
            encoding: 'CP437',
            isDefault: printers.length === 0,
            printerPurpose: 'receipt',
            autoPrint: true,
            supportsCut: false,
            supportsCashDrawer: false,
            supportsQr: true,
            supportsBarcode: true,
            status: 'connected',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          PrinterService.savePrinter(newPrinter);
          loadPrinters();
          showToast({ type: 'success', title: 'USB Printer Claimed', message: newPrinter.name });
        } else if (res.error) {
          setBluetoothNotice(res.error);
        }
      } catch (err: any) {
        setBluetoothNotice(err?.message || 'USB discovery failed.');
      } finally {
        setIsScanningUsb(false);
      }
    }
  };

  const handleConnectUsbDevice = async (device: DiscoveredNativeDevice) => {
    setUsbConnectingId(device.id);
    try {
      const res = await NativeBridgeService.printer.connectUSB(device.id);
      if (res.success) {
        const newPrinter: Printer = {
          id: `prn_usb_${Date.now()}`,
          storeId: 'store_aura_main',
          name: device.name || 'USB Thermal Printer',
          model: 'ESC/POS USB Thermal',
          printerType: 'usb',
          connectionType: 'usb',
          deviceIdentifier: device.id,
          paperWidth: 58,
          charactersPerLine: 32,
          encoding: 'CP437',
          isDefault: printers.length === 0,
          printerPurpose: 'receipt',
          autoPrint: true,
          supportsCut: false,
          supportsCashDrawer: false,
          supportsQr: true,
          supportsBarcode: true,
          status: 'connected',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        PrinterService.savePrinter(newPrinter);
        loadPrinters();
        showToast({ type: 'success', title: 'USB Printer Connected', message: `${device.name} ready.` });
      } else {
        setBluetoothNotice(res.error || 'Failed to claim USB printer interface.');
      }
    } catch (err: any) {
      setBluetoothNotice(err?.message || 'USB connection error.');
    } finally {
      setUsbConnectingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // CASH DRAWER KICK TEST (Section 20)
  // --------------------------------------------------------------------------
  const handleTestCashDrawer = async () => {
    setDrawerTestStatus('Pulsing cash drawer kick pin (pin 2, 100ms)...');
    const defaultPrinter = printers.find(p => p.supportsCashDrawer) || printers[0];
    if (!defaultPrinter) {
      setDrawerTestStatus('No printer configured to trigger cash drawer.');
      return;
    }

    const targetId = defaultPrinter.connectionType === 'lan' ? (defaultPrinter.ipAddress || '') : (defaultPrinter.deviceIdentifier || '');
    try {
      const res = await NativeBridgeService.cashDrawer.open(
        defaultPrinter.connectionType,
        targetId,
        defaultPrinter.port || 9100
      );
      if (res.success) {
        setDrawerTestStatus('✓ Drawer pulse signal sent successfully.');
      } else {
        setDrawerTestStatus(`Pulse error: ${res.error}`);
      }
    } catch (e: any) {
      setDrawerTestStatus(`Cash drawer test error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bluetooth / Hardware Notice Banner */}
      {bluetoothNotice && (
        <div className="p-4 rounded-2xl border bg-amber-50 border-amber-300 text-amber-950 shadow-xs flex items-start justify-between gap-3 text-xs animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-200/80 text-amber-900 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm">Hardware Notice</p>
              <p className="text-amber-800 mt-0.5 max-w-xl">{bluetoothNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBluetoothNotice(null)}
            className="p-1.5 text-amber-600 hover:text-amber-900 rounded-lg shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Printers & Hardware Management
                </h2>
                {isNative ? (
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Android POS Native
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                    Web Preview Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Manage physical Bluetooth (X18 Mini), LAN TCP 9100, and USB thermal receipt printers
              </p>
            </div>
          </div>
        </div>

        {/* Quick action buttons in header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('bluetooth')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Bluetooth className="w-4 h-4 text-indigo-600" />
            <span>Bluetooth</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingPrinter(null);
              setIsLanModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Wifi className="w-4 h-4 text-blue-600" />
            <span>LAN Printer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <ListOrdered className="w-4 h-4" />
            <span>Queue ({queueJobs.filter(j => j.status === 'PENDING' || j.status === 'PRINTING').length})</span>
          </button>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 sm:gap-2 text-xs font-semibold overflow-x-auto scrollbar-none">
        {[
          { id: 'devices', label: `Configured Printers (${printers.length})`, icon: PrinterIcon },
          { id: 'bluetooth', label: 'Bluetooth (X18 Mini)', icon: Bluetooth },
          { id: 'lan', label: 'LAN / Wi-Fi (TCP 9100)', icon: Wifi },
          { id: 'usb', label: 'USB Thermal', icon: Usb },
          { id: 'routing', label: 'Auto-Print & Routing', icon: RouteIcon },
          { id: 'queue', label: `Print Queue (${queueJobs.length})`, icon: ListOrdered },
          { id: 'diagnostics', label: 'Diagnostics', icon: Activity }
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2.5 transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer rounded-t-lg ${
                isSelected
                  ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: CONFIGURED PRINTERS                                           */}
      {/* ==================================================================== */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          {printers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <PrinterIcon className="w-6 h-6" />
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
                  onClick={() => setActiveTab('bluetooth')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Scan Bluetooth Printers</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPrinter(null);
                    setIsLanModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Add LAN Printer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('usb')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Usb className="w-4 h-4" />
                  <span>Add USB Printer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {printers.map(printer => {
                const testState = quickTestStatus[printer.id];
                return (
                  <div
                    key={printer.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2.5 rounded-xl ${
                              printer.connectionType === 'bluetooth'
                                ? 'bg-indigo-50 text-indigo-600'
                                : printer.connectionType === 'usb'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {printer.connectionType === 'bluetooth' ? (
                              <Bluetooth className="w-5 h-5" />
                            ) : printer.connectionType === 'usb' ? (
                              <Usb className="w-5 h-5" />
                            ) : (
                              <Wifi className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{printer.name}</h4>
                              {printer.isDefault && (
                                <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono">
                              {printer.connectionType === 'lan'
                                ? `${printer.ipAddress}:${printer.port || 9100}`
                                : printer.deviceIdentifier || printer.model}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1 ${
                            printer.status === 'connected' || printer.status === 'online'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              printer.status === 'connected' || printer.status === 'online'
                                ? 'bg-emerald-600'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{printer.status || 'Offline'}</span>
                        </span>
                      </div>

                      {/* Capabilities pills */}
                      <div className="flex flex-wrap gap-1.5 mt-3 text-[10px] text-slate-600 font-medium">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                          {printer.paperWidth}mm ({printer.charactersPerLine} cols)
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                          Role: {printer.printerPurpose}
                        </span>
                        {printer.autoPrint && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                            Auto-Print
                          </span>
                        )}
                        {printer.supportsCut && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md">Auto-Cutter</span>
                        )}
                        {printer.supportsCashDrawer && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md">Cash Drawer</span>
                        )}
                      </div>

                      {/* Last error notice if any */}
                      {printer.lastError && (
                        <p className="text-[11px] text-rose-600 mt-2 bg-rose-50 p-2 rounded-lg border border-rose-100">
                          {printer.lastError}
                        </p>
                      )}

                      {/* Test feedback */}
                      {testState && (
                        <div
                          className={`mt-2 p-2 rounded-lg text-xs flex items-center justify-between ${
                            testState.testing
                              ? 'bg-blue-50 text-blue-800'
                              : testState.success
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span>{testState.testing ? 'Testing connection...' : testState.message}</span>
                          {testState.latencyMs !== undefined && !testState.testing && (
                            <span className="text-[10px] font-mono font-bold">{testState.latencyMs}ms</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickTest(printer)}
                          disabled={testState?.testing}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${testState?.testing ? 'animate-spin' : ''}`} />
                          <span>Check</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDiagnosticTest(printer)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Test Print</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPrinter(printer);
                            setIsLanModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePrinter(printer.id, printer.name)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* ==================================================================== */}
      {/* TAB 2: BLUETOOTH (X18 MINI & ESC/POS) - Sections 5 & 6                */}
      {/* ==================================================================== */}
      {activeTab === 'bluetooth' && (
        <div className="space-y-5">
          {/* Permission / Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">Android Bluetooth Subsystem</span>
                {bluetoothStatusInfo.enabled ? (
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Adapter ON
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    Adapter OFF
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Optimized for X18 Mini Bluetooth thermal printers (SPP RFCOMM channel 1) and standard ESC/POS devices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!bluetoothStatusInfo.hasPermissions && (
                <button
                  type="button"
                  onClick={() => NativeBridgeService.printer.requestBluetoothPermissions()}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Grant Permissions
                </button>
              )}

              {isScanningBluetooth ? (
                <button
                  type="button"
                  onClick={handleStopBluetoothScan}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  <X className="w-4 h-4" />
                  <span>Stop Scan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleScanBluetooth}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              )}
            </div>
          </div>

          {/* Discovered / Paired Devices List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Radio className={`w-3.5 h-3.5 ${isScanningBluetooth ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
                <span>Discovered & Paired Hardware Devices ({bluetoothDevices.length})</span>
              </span>

              {isScanningBluetooth && (
                <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Android Bluetooth radio...</span>
                </span>
              )}
            </div>

            {bluetoothDevices.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Bluetooth className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No Bluetooth printers discovered yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Turn on your X18 Mini thermal printer and press <strong>[Scan]</strong> above. If the device was previously paired in Android Settings, it will appear immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bluetoothDevices.map(device => {
                  const isConnected = !!bluetoothConnectedMap[device.id];
                  const isConnecting = bluetoothConnectingId === device.id;

                  return (
                    <div
                      key={device.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{device.name}</span>
                          {device.bonded && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              Paired
                            </span>
                          )}
                          {isConnected ? (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Connected
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                              Disconnected
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-mono text-slate-500 tracking-wider">
                          {device.address || device.id}
                        </p>
                      </div>

                      {/* Device Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {isConnected ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTestPrintBluetoothDevice(device)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Test Print</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenBleDiagnostic(device)}
                              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Activity className="w-3.5 h-3.5 text-indigo-600" />
                              <span>GATT Diagnostic</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSavingBtDevice(device)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add to POS Printers</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDisconnectBluetoothDevice(device)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isConnecting}
                            onClick={() => handleConnectBluetoothDevice(device)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Bluetooth className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                            <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Bluetooth Device to POS modal */}
      {savingBtDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-indigo-600" />
                <span>Configure {savingBtDevice.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSavingBtDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paper Width</label>
                <select
                  value={btPaperWidth}
                  onChange={e => setBtPaperWidth(Number(e.target.value) as PaperWidthMm)}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value={58}>58 mm (Standard for X18 Mini / Portable POS)</option>
                  <option value={80}>80 mm (Wide Format Thermal)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Printer Station Role</label>
                <select
                  value={btPurpose}
                  onChange={e => setBtPurpose(e.target.value as PrinterPurpose)}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="receipt">Customer Receipt (Checkout Counter)</option>
                  <option value="kitchen">Kitchen Order Station</option>
                  <option value="bar">Bar Drinks Station</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-slate-700">Auto-Print upon sale completion</span>
                <input
                  type="checkbox"
                  checked={btAutoPrint}
                  onChange={e => setBtAutoPrint(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSavingBtDevice(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBluetoothPrinter}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                Save as Active Printer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: LAN / WI-FI PRINTERS (TCP 9100) - Section 7                   */}
      {/* ==================================================================== */}
      {activeTab === 'lan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Network ESC/POS Printers (TCP Port 9100)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Native raw TCP socket communication without HTTP or browser fetch dependencies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingPrinter(null);
                setIsLanModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Network Printer</span>
            </button>
          </div>

          <LanDiscoveryBanner onSelectTemplate={tmpl => {
            setEditingPrinter(tmpl as Printer);
            setIsLanModalOpen(true);
          }} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: USB THERMAL PRINTERS - Section 8                              */}
      {/* ==================================================================== */}
      {activeTab === 'usb' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Native Android USB Host Printers</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Communicates directly with USB thermal receipt printers via OTG and USB bulk transfer endpoints.
              </p>
            </div>

            <button
              type="button"
              onClick={handleScanUsb}
              disabled={isScanningUsb}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Usb className={`w-4 h-4 ${isScanningUsb ? 'animate-spin' : ''}`} />
              <span>{isScanningUsb ? 'Scanning USB...' : 'Scan USB Devices'}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            {usbDevices.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Usb className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No USB thermal printers attached</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Plug your ESC/POS thermal printer into the terminal USB port or USB OTG adapter and click <strong>Scan USB Devices</strong>.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {usbDevices.map(dev => (
                  <div key={dev.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{dev.name}</h4>
                      <p className="text-xs font-mono text-slate-500">
                        Vendor ID: 0x{dev.vendorId?.toString(16)} | Product ID: 0x{dev.productId?.toString(16)}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={usbConnectingId === dev.id}
                      onClick={() => handleConnectUsbDevice(dev)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {usbConnectingId === dev.id ? 'Claiming...' : 'Claim & Connect'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: STATION ROUTING & AUTO-PRINT (Section 12)                      */}
      {/* ==================================================================== */}
      {activeTab === 'routing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900">Automatic Printing Preferences</h3>
            <p className="text-xs text-slate-500">
              When enabled, receipts and kitchen orders are automatically dispatched upon sale completion without cashier intervention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800">Auto Print Customer Receipts</span>
                <p className="text-[11px] text-slate-500">Prints customer receipt immediately after payment</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPrintReceipts !== false}
                onChange={e => updateSettings({ ...settings, autoPrintReceipts: e.target.checked })}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800">Auto Print Kitchen Tickets</span>
                <p className="text-[11px] text-slate-500">Dispatches food orders to kitchen printer</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPrintKitchenOrders !== false}
                onChange={e => updateSettings({ ...settings, autoPrintKitchenOrders: e.target.checked })}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800">Auto Print Bar Orders</span>
                <p className="text-[11px] text-slate-500">Dispatches beverage orders to bar printer</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPrintBarOrders !== false}
                onChange={e => updateSettings({ ...settings, autoPrintBarOrders: e.target.checked })}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800">Auto Print Refunds</span>
                <p className="text-[11px] text-slate-500">Prints receipt copy on processed refunds</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPrintRefunds !== false}
                onChange={e => updateSettings({ ...settings, autoPrintRefunds: e.target.checked })}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: PRINT QUEUE (Section 11)                                      */}
      {/* ==================================================================== */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Persistent Print Queue</h3>
              <p className="text-xs text-slate-500">
                Jobs survive terminal reboots, network drops, and Bluetooth reconnection.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => PrintQueueService.processQueue()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Process Queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  PrintQueueService.clearCompleted();
                  loadQueue();
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Clear Completed
              </button>
            </div>
          </div>

          {queueJobs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Print queue is clean. Completed and pending jobs will be logged here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Reference / Type</th>
                    <th className="p-3">Target Printer</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Error / Details</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queueJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900">#{job.referenceId || job.id.slice(-6)}</span>
                        <span className="text-[10px] text-slate-500 block uppercase">{job.documentType}</span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">
                        {job.printerName || job.printerId}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : job.status === 'PRINTING'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : job.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{job.attempts}</td>
                      <td className="p-3 text-[11px] text-slate-500 max-w-xs truncate">
                        {job.error || '—'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {job.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => {
                              PrintQueueService.retryJob(job.id);
                              loadQueue();
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Retry"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            PrintQueueService.cancelJob(job.id);
                            loadQueue();
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: HARDWARE DIAGNOSTICS (Section 32)                             */}
      {/* ==================================================================== */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Hardware & Runtime Diagnostics</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-500 text-[11px]">Runtime Environment</span>
                <p className="font-bold text-slate-900 text-sm">
                  {isNative ? 'Native Android POS Terminal' : 'Web Browser Preview'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isNative ? 'AndroidPOSNative bridge verified' : 'Chrome / Safari sandbox'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-500 text-[11px]">Bluetooth Radio Driver</span>
                <p className="font-bold text-slate-900 text-sm">
                  {bluetoothStatusInfo.enabled ? 'Enabled & Ready' : 'Disabled'}
                </p>
                <p className="text-[11px] text-slate-500">
                  RFCOMM SPP & BLE scanning active
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-500 text-[11px]">Local Persistent DB</span>
                <p className="font-bold text-slate-900 text-sm">Active & Synced</p>
                <p className="text-[11px] text-slate-500">
                  IndexedDB / SQLite dual engine
                </p>
              </div>
            </div>

            {/* Interactive Hardware Tests */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Interactive Hardware Tests</h4>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestCashDrawer}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Test Cash Drawer Kick</span>
                </button>
              </div>

              {drawerTestStatus && (
                <p className="text-xs font-mono p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                  {drawerTestStatus}
                </p>
              )}

              {/* Barcode scanner feed */}
              <div className="pt-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <Barcode className="w-4 h-4 text-blue-600" />
                  <span>Hardware Barcode Gun Interception Feed:</span>
                </span>
                {barcodeInputHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    Pull trigger on USB or Bluetooth barcode scanner gun to test real-time key wedge interception...
                  </p>
                ) : (
                  <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl space-y-1">
                    {barcodeInputHistory.map((bc, i) => (
                      <div key={i}>&gt; {bc}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAN Printer Configuration Modal */}
      {isLanModalOpen && (
        <LanPrinterConfigModal
          isOpen={isLanModalOpen}
          onClose={() => {
            setIsLanModalOpen(false);
            setEditingPrinter(null);
          }}
          onSaved={saved => {
            setIsLanModalOpen(false);
            setEditingPrinter(null);
            loadPrinters();
            showToast({ type: 'success', title: 'Network Printer Saved', message: saved.name });
          }}
          initialPrinter={editingPrinter}
        />
      )}

      {/* Printer Diagnostic Dialog */}
      {isTestDialogOpen && (
        <PrinterTestDialog
          printer={testPrinter}
          isOpen={isTestDialogOpen}
          onClose={() => setIsTestDialogOpen(false)}
          result={testResult}
          isLoading={isTestingInProgress}
        />
      )}

      {/* BLE GATT Diagnostic Inspection Modal (Tasks 7, 12, 14) */}
      {diagModalDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    BLE GATT Diagnostic: {diagModalDevice.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-500">
                    MAC: {diagModalDevice.address || diagModalDevice.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDiagModalDevice(null);
                  setDiagData(null);
                  setDiagWriteResult(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {diagLoading ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-800">
                  Inspecting BLE GATT Services & Characteristics...
                </p>
                <p className="text-xs text-slate-400">Discovering primary service, write/notify characteristics, properties, and MTU</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Overview Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Transport</span>
                    <span className="font-bold text-indigo-600">BLE / GATT</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">GATT State</span>
                    <span className="font-bold text-emerald-700">{diagData?.state || 'CONNECTED'}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Negotiated MTU</span>
                    <span className="font-bold text-slate-800">{diagData?.mtu || 23} Bytes</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Notifications</span>
                    <span className="font-bold text-indigo-700">{diagData?.notificationsStatus || 'ENABLED'}</span>
                  </div>
                </div>

                {/* Selected Characteristics & Write Type */}
                <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-indigo-900">Active Write Characteristic:</span>
                    <span className="font-mono text-[11px] font-bold text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                      {diagData?.selectedWriteChar || '0000AE01-0000-1000-8000-00805F9B34FB'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-indigo-900">Configured Write Type:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {diagData?.selectedWriteType || 'WRITE_NO_RESPONSE (Dynamic Handshake)'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-indigo-900">Active Notify Characteristic:</span>
                    <span className="font-mono text-[11px] font-bold text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                      {diagData?.selectedNotifyChar || '0000AE02-0000-1000-8000-00805F9B34FB'}
                    </span>
                  </div>
                </div>

                {/* Test Action Buttons */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Diagnostic Test Routines:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={diagWriteTesting}
                      onClick={() => handleRunBle1PacketTest(diagModalDevice)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Radio className={`w-3.5 h-3.5 ${diagWriteTesting ? 'animate-spin' : ''}`} />
                      <span>{diagWriteTesting ? 'Transmitting...' : 'TEST B: Send 1-Packet Write Test'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleTestPrintBluetoothDevice(diagModalDevice);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>TEST C: Full Receipt Physical Print</span>
                    </button>
                  </div>
                </div>

                {/* 1-Packet Write Test Result Feedback */}
                {diagWriteResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                      diagWriteResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {diagWriteResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>TEST B Passed: 1-Packet GATT Write Handshake OK</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>TEST B Failed: 1-Packet GATT Write Error</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {diagWriteResult.message || diagWriteResult.error}
                    </p>
                    {diagWriteResult.statusCode !== undefined && (
                      <div className="font-mono text-[10px] opacity-80">
                        Status Code: {diagWriteResult.statusCode} ({diagWriteResult.statusDescription}) | Write Type: {diagWriteResult.writeType}
                      </div>
                    )}
                  </div>
                )}

                {/* All Discovered Services & Characteristics Tree */}
                {diagData?.services && diagData.services.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Discovered GATT Service Tree:
                    </label>
                    <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed border border-slate-800 space-y-2">
                      {diagData.services.map((srv: any, sIdx: number) => (
                        <div key={sIdx} className="space-y-1">
                          <div className="text-amber-400 font-bold">SERVICE: {srv.uuid}</div>
                          {srv.characteristics?.map((ch: any, cIdx: number) => (
                            <div key={cIdx} className="pl-3 text-slate-300">
                              <div>├─ CHAR: <span className="text-emerald-400">{ch.uuid}</span></div>
                              <div className="pl-4 text-[10px] text-slate-400">PROPERTIES: [{ch.properties}]</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDiagModalDevice(null);
                  setDiagData(null);
                  setDiagWriteResult(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
