import React from 'react';
import { Printer } from '../../../types/printer.ts';
import { CheckCircle2, AlertCircle, Clock, X, Printer as PrinterIcon } from 'lucide-react';

interface PrinterTestDialogProps {
  printer: Printer | null;
  isOpen: boolean;
  onClose: () => void;
  result: {
    success: boolean;
    latencyMs?: number;
    message: string;
    previewText?: string;
  } | null;
  isLoading: boolean;
}

export const PrinterTestDialog: React.FC<PrinterTestDialogProps> = ({
  printer,
  isOpen,
  onClose,
  result,
  isLoading
}) => {
  if (!isOpen || !printer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">ESC/POS Network Diagnostic</h3>
              <p className="text-xs text-slate-400">
                {printer.name} ({printer.ipAddress || 'Bluetooth'}:{printer.port || 9100})
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                Testing TCP Socket Handshake to {printer.ipAddress}:{printer.port || 9100}...
              </p>
              <p className="text-xs text-slate-400">Pinging local ESC/POS thermal printer</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  result.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {result.success ? '✓ Printer Reachable' : '✕ Printer Unreachable'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed">{result.message}</p>
                  {result.latencyMs !== undefined && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono mt-2 font-semibold opacity-80">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Round-trip latency: {result.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hardware specifications */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Protocol</span>
                  <span className="font-medium text-slate-800">TCP Raw ESC/POS</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Paper Profile</span>
                  <span className="font-medium text-slate-800">
                    {printer.paperWidth} mm ({printer.charactersPerLine} columns)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Socket</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {printer.ipAddress}:{printer.port || 9100}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Encoding</span>
                  <span className="font-medium text-slate-800">{printer.encoding}</span>
                </div>
              </div>

              {/* Preview text if available */}
              {result.previewText && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    ESC/POS Rendered Output Preview:
                  </label>
                  <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed border border-slate-800">
                    {result.previewText}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
