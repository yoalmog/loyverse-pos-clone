import React, { useState } from 'react';
import { Printer } from '../../../types/printer.ts';
import { BluetoothPrinterService } from '../../../services/printer/bluetoothPrinterService.ts';
import { PrinterService } from '../../../services/PrinterService.ts';
import { EscPosNetworkAdapter } from '../../../services/printer/adapters/escposNetworkAdapter.ts';
import { Wifi, Bluetooth, Search, Plus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface LanDiscoveryBannerProps {
  onSelectTemplate: (template: Partial<Printer>) => void;
}

export const LanDiscoveryBanner: React.FC<LanDiscoveryBannerProps> = ({ onSelectTemplate }) => {
  const [isScanningBluetooth, setIsScanningBluetooth] = useState<boolean>(false);
  const [bluetoothResult, setBluetoothResult] = useState<{ success: boolean; message: string } | null>(null);

  // LAN IP Probe
  const [probeIp, setProbeIp] = useState<string>('');
  const [probePort, setProbePort] = useState<number>(9100);
  const [isProbingLan, setIsProbingLan] = useState<boolean>(false);
  const [lanProbeResult, setLanProbeResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  // Scan Real Bluetooth
  const handleScanBluetooth = async () => {
    setIsScanningBluetooth(true);
    setBluetoothResult(null);
    try {
      const res = await BluetoothPrinterService.scanAndPair();
      if (res.success && res.printer) {
        const newPrinter: Printer = {
          id: `prn_bt_${Date.now()}`,
          storeId: 'store_aura_main',
          name: res.printer.name || 'Bluetooth Printer',
          model: res.printer.protocol || 'ESC/POS Bluetooth Thermal',
          printerType: 'x18',
          connectionType: 'bluetooth',
          deviceIdentifier: res.printer.id,
          paperWidth: res.printer.paperWidth || 58,
          charactersPerLine: res.printer.paperWidth === 80 ? 48 : 32,
          encoding: 'CP437',
          isDefault: true,
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
        PrinterService.savePrinter(newPrinter);
        setBluetoothResult({
          success: true,
          message: `Paired successfully with "${newPrinter.name}". Added to configured printers.`
        });
      } else if (res.error) {
        setBluetoothResult({
          success: false,
          message: res.error
        });
      }
    } catch (err: any) {
      setBluetoothResult({
        success: false,
        message: err.message || 'Bluetooth connection failed.'
      });
    } finally {
      setIsScanningBluetooth(false);
    }
  };

  // Real LAN IP Probe
  const handleProbeLan = async () => {
    setIsProbingLan(true);
    setLanProbeResult(null);

    try {
      const adapter = new EscPosNetworkAdapter();
      const testRes = await adapter.testConnection({
        id: 'probe_temp',
        storeId: 'store_aura_main',
        name: 'Probe',
        model: 'Generic ESC/POS',
        printerType: 'escpos',
        connectionType: 'lan',
        ipAddress: probeIp,
        port: probePort,
        paperWidth: 80,
        charactersPerLine: 48,
        encoding: 'auto',
        isDefault: false,
        printerPurpose: 'receipt',
        autoPrint: true,
        supportsCut: true,
        supportsCashDrawer: false,
        supportsQr: true,
        supportsBarcode: true,
        status: 'online',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setLanProbeResult({
        success: testRes.success,
        message: testRes.message,
        latency: testRes.latencyMs
      });
    } catch (err: any) {
      setLanProbeResult({
        success: false,
        message: err.message || 'Socket error communicating with target LAN IP.'
      });
    } finally {
      setIsProbingLan(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md space-y-5">
      {/* 1. Bluetooth Scanner Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/30 text-indigo-400">
            <Bluetooth className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight">Wireless Bluetooth Printer Discovery</h4>
            <p className="text-xs text-slate-400">
              Scan for nearby Bluetooth ESC/POS receipt printers (e.g. X18 Mini, POS-58, MPT-II, Cat Printers)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleScanBluetooth}
          disabled={isScanningBluetooth}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <Bluetooth className={`w-4 h-4 ${isScanningBluetooth ? 'animate-spin' : ''}`} />
          <span>{isScanningBluetooth ? 'Scanning Bluetooth...' : 'Scan Bluetooth Printers'}</span>
        </button>
      </div>

      {bluetoothResult && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            bluetoothResult.success
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-800 text-rose-300'
          }`}
        >
          {bluetoothResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{bluetoothResult.message}</span>
        </div>
      )}

      {/* 2. Real LAN Host Probe */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight">LAN ESC/POS Host Probe (Port 9100)</h4>
            <p className="text-xs text-slate-400">
              Check real connectivity to a network thermal printer on your local subnet
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Printer IP Address</label>
            <input
              type="text"
              value={probeIp}
              onChange={e => setProbeIp(e.target.value)}
              placeholder="e.g. 192.168.1.100"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="w-24">
            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Port</label>
            <input
              type="number"
              value={probePort}
              onChange={e => setProbePort(parseInt(e.target.value, 10) || 9100)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleProbeLan}
              disabled={isProbingLan}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isProbingLan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>{isProbingLan ? 'Probing...' : 'Probe Host'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onSelectTemplate({
                  name: `LAN Thermal (${probeIp})`,
                  ipAddress: probeIp,
                  port: probePort,
                  model: 'Generic ESC/POS LAN',
                  printerType: 'escpos',
                  connectionType: 'lan',
                  paperWidth: 80,
                  printerPurpose: 'receipt',
                  isDefault: false
                })
              }
              className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Configure</span>
            </button>
          </div>
        </div>

        {lanProbeResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
              lanProbeResult.success
                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-800 text-rose-300'
            }`}
          >
            {lanProbeResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{lanProbeResult.message}</span>
            {lanProbeResult.latency !== undefined && (
              <span className="ml-auto font-mono text-[10px] text-slate-400">({lanProbeResult.latency}ms)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
