import React, { useState } from 'react';
import {
  Printer,
  PrinterPurpose,
  PaperWidthMm,
  PrinterEncoding
} from '../../../types/printer.ts';
import { PrinterService, AdapterTestResult } from '../../../services/PrinterService.ts';
import {
  Wifi,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer as PrinterIcon,
  Play,
  X,
  Server,
  Layers,
  Settings2,
  Sliders
} from 'lucide-react';

interface LanPrinterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (printer: Printer) => void;
  initialPrinter?: Printer | null;
}

export const LanPrinterConfigModal: React.FC<LanPrinterConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialPrinter
}) => {
  if (!isOpen) return null;

  // Form state
  const [name, setName] = useState<string>(initialPrinter?.name || '');
  const [ipAddress, setIpAddress] = useState<string>(initialPrinter?.ipAddress || '');
  const [port, setPort] = useState<number>(initialPrinter?.port || 9100);
  const [model, setModel] = useState<string>(initialPrinter?.model || 'Generic ESC/POS Network Printer');
  const [paperWidth, setPaperWidth] = useState<PaperWidthMm>(initialPrinter?.paperWidth || 80);
  const [charactersPerLine, setCharactersPerLine] = useState<number>(
    initialPrinter?.charactersPerLine || (initialPrinter?.paperWidth === 58 ? 32 : 48)
  );
  const [encoding, setEncoding] = useState<PrinterEncoding>(initialPrinter?.encoding || 'auto');
  const [purpose, setPurpose] = useState<PrinterPurpose>(initialPrinter?.printerPurpose || 'receipt');
  const [isDefault, setIsDefault] = useState<boolean>(initialPrinter?.isDefault ?? true);
  const [autoPrint, setAutoPrint] = useState<boolean>(initialPrinter?.autoPrint ?? true);
  const [supportsCut, setSupportsCut] = useState<boolean>(initialPrinter?.supportsCut ?? true);
  const [supportsCashDrawer, setSupportsCashDrawer] = useState<boolean>(
    initialPrinter?.supportsCashDrawer ?? true
  );
  const [supportsQr, setSupportsQr] = useState<boolean>(initialPrinter?.supportsQr ?? true);
  const [supportsBarcode, setSupportsBarcode] = useState<boolean>(
    initialPrinter?.supportsBarcode ?? true
  );

  // Testing states
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<AdapterTestResult | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState<boolean>(false);
  const [testPrintSuccess, setTestPrintSuccess] = useState<boolean | null>(null);
  const [testPrintPreview, setTestPrintPreview] = useState<string | null>(null);

  // Auto adjust characters per line when paper width changes
  const handlePaperWidthChange = (w: PaperWidthMm) => {
    setPaperWidth(w);
    if (w === 58) setCharactersPerLine(32);
    else if (w === 76) setCharactersPerLine(42);
    else setCharactersPerLine(48);
  };

  // Build transient printer object for testing
  const buildCurrentPrinterObject = (): Printer => ({
    id: initialPrinter?.id || `lan_printer_${Date.now()}`,
    storeId: initialPrinter?.storeId || 'store_1',
    name,
    model,
    printerType: 'escpos',
    connectionType: 'lan',
    ipAddress,
    port,
    paperWidth,
    charactersPerLine,
    encoding,
    isDefault,
    printerPurpose: purpose,
    autoPrint,
    supportsCut,
    supportsCashDrawer,
    supportsQr,
    supportsBarcode,
    status: testResult?.success ? 'connected' : 'disconnected',
    createdAt: initialPrinter?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Action: Test TCP Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestPrintSuccess(null);

    const printerObj = buildCurrentPrinterObject();
    try {
      const res = await PrinterService.testConnection(printerObj);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection test failed',
        error: 'TEST_ERROR'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Action: Send Test Print
  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setTestPrintSuccess(null);
    setTestPrintPreview(null);

    const printerObj = buildCurrentPrinterObject();
    try {
      const res = await PrinterService.testPrint(printerObj);
      setTestPrintSuccess(res.success);
      if (res.previewText) {
        setTestPrintPreview(res.previewText);
      }
    } catch (err: any) {
      setTestPrintSuccess(false);
    } finally {
      setIsTestPrinting(false);
    }
  };

  // Action: Save Printer
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const printerObj = buildCurrentPrinterObject();
    PrinterService.savePrinter(printerObj);
    onSaved(printerObj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {initialPrinter ? 'Edit LAN ESC/POS Printer' : 'Add LAN ESC/POS Printer'}
              </h3>
              <p className="text-xs text-slate-400">
                Network receipt printer · Ethernet / Wi-Fi · TCP Port 9100
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-blue-600" />
              <span>Printer Identity & Network Socket</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Printer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Front Counter Printer"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Printer Hardware Model
                </label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Generic ESC/POS">Generic ESC/POS</option>
                  <option value="Epson TM-T20 / TM-T88">Epson-compatible (TM-T20 / TM-T88)</option>
                  <option value="Xprinter XP-N160M / XP-Q800">Xprinter-compatible</option>
                  <option value="Rongta RP80 / RP326">Rongta-compatible</option>
                  <option value="Star Micronics TSP100 (ESC/POS Mode)">Star Micronics</option>
                  <option value="Other ESC/POS Thermal">Other Thermal Printer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Local IP Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ipAddress}
                  onChange={e => setIpAddress(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Reachable from local subnet (e.g. 192.168.1.x)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Port <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={e => setPort(parseInt(e.target.value, 10) || 9100)}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Standard: 9100</span>
              </div>
            </div>
          </div>

          {/* Section 2: Connection Test & Print Action Row */}
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Verify LAN Reachability
                </span>
                <span className="text-[11px] text-slate-500">
                  Tests TCP handshake to {ipAddress}:{port} before saving
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !ipAddress}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isTesting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing TCP...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTestPrinting || !ipAddress}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isTestPrinting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Printing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Test Print</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Connection Result Box */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold">
                    {testResult.success ? '✓ Printer reachable' : '✕ Printer unreachable'}
                  </div>
                  <div className="text-[11px] mt-0.5">{testResult.message}</div>
                  {testResult.latencyMs !== undefined && (
                    <div className="text-[10px] font-mono mt-1 opacity-75 font-semibold">
                      Latency: {testResult.latencyMs}ms
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Print Result Banner */}
            {testPrintSuccess !== null && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  testPrintSuccess
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PrinterIcon className="w-4 h-4" />
                  <span className="font-bold">
                    {testPrintSuccess
                      ? '✓ Test receipt dispatched to printer'
                      : '✕ Test print transmission failed'}
                  </span>
                </div>
                {testPrintPreview && (
                  <span className="text-[10px] font-mono bg-white/70 px-2 py-0.5 rounded border border-emerald-200">
                    ESC/POS feed & cut issued
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Paper Profile & Character Encoding */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Paper Dimensions & Encoding</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paper Width
                </label>
                <select
                  value={paperWidth}
                  onChange={e => handlePaperWidthChange(parseInt(e.target.value, 10) as PaperWidthMm)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={80}>80 mm (Standard POS)</option>
                  <option value={58}>58 mm (Compact)</option>
                  <option value={76}>76 mm (Kitchen Impact)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Characters Per Line
                </label>
                <input
                  type="number"
                  value={charactersPerLine}
                  onChange={e => setCharactersPerLine(parseInt(e.target.value, 10) || 48)}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Configurable column wrapping
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Character Encoding
                </label>
                <select
                  value={encoding}
                  onChange={e => setEncoding(e.target.value as PrinterEncoding)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="UTF-8">UTF-8 (International)</option>
                  <option value="CP437">CP437 (USA / Standard ASCII)</option>
                  <option value="CP850">CP850 (Multilingual Western)</option>
                  <option value="CP858">CP858 (Western + Euro €)</option>
                  <option value="Windows-1252">Windows-1252 (ANSI Latin 1)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Role & Purpose */}
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Station Routing & Hardware Features</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Printer Purpose / Role
                </label>
                <select
                  value={purpose}
                  onChange={e => setPurpose(e.target.value as PrinterPurpose)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="receipt">Front Counter Receipt</option>
                  <option value="kitchen">Kitchen Order Station</option>
                  <option value="bar">Bar Order Station</option>
                  <option value="label">Adhesive Label Printer</option>
                  <option value="report">End of Day Reports</option>
                </select>
              </div>

              <div className="flex flex-col justify-end space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={e => setIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Set as default for {purpose}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={e => setAutoPrint(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Auto-print on transaction completion
                  </span>
                </label>
              </div>
            </div>

            {/* Hardware checkboxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsCut}
                  onChange={e => setSupportsCut(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700">Auto Cutter</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsCashDrawer}
                  onChange={e => setSupportsCashDrawer(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700">Cash Drawer</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsQr}
                  onChange={e => setSupportsQr(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700">QR Code</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsBarcode}
                  onChange={e => setSupportsBarcode(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700">1D Barcode</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Save Printer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
