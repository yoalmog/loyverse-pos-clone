import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '../../context/POSContext.tsx';
import { PrintService } from '../../services/printer/printService.ts';
import { Printer, PrintJob } from '../../types/printer.ts';
import {
  Printer as PrinterIcon,
  Wifi,
  Bluetooth,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Settings,
  RefreshCw,
  X
} from 'lucide-react';

export const PrinterHeaderIndicator: React.FC = () => {
  const { setActiveRoute } = usePOS();
  const [isOpen, setIsOpen] = useState(false);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [activeJobs, setActiveJobs] = useState<PrintJob[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    setPrinters(PrintService.getPrinters());
    const jobs = PrintService.getPrintJobs();
    setActiveJobs(jobs.filter(j => j.status === 'printing' || j.status === 'queued'));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const receiptPrinter = printers.find(p => p.printerPurpose === 'receipt' && p.isDefault) || printers.find(p => p.printerPurpose === 'receipt');
  const kitchenPrinter = printers.find(p => p.printerPurpose === 'kitchen');
  const barPrinter = printers.find(p => p.printerPurpose === 'bar');

  const hasOffline = printers.some(p => p.status === 'offline' || p.status === 'error');
  const isBusy = activeJobs.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          loadData();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
          isBusy
            ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
            : hasOffline
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Printer System Status (X18 Mini & LAN ESC/POS)"
        aria-label="Printer Status"
      >
        <PrinterIcon className="w-4 h-4 text-slate-600" />
        <span className="hidden sm:inline font-semibold">Printers</span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isBusy
              ? 'bg-amber-500 animate-ping'
              : hasOffline
              ? 'bg-rose-500'
              : 'bg-emerald-500'
          }`}
        />
        {activeJobs.length > 0 && (
          <span className="text-[10px] font-mono bg-amber-200 text-amber-800 px-1 rounded font-bold">
            {activeJobs.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 select-none animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PrinterIcon className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Printer System Status</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Status List (Section 29) */}
          <div className="p-3 space-y-2 text-xs">
            {/* Receipt Printer */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
                <div className="truncate">
                  <p className="font-semibold text-slate-900 truncate">
                    Receipt: {receiptPrinter ? receiptPrinter.name : 'X18 Mini'}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Bluetooth className="w-3 h-3 text-blue-500" /> Bluetooth (58mm)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                {receiptPrinter?.status === 'offline' ? 'Offline' : 'Ready'}
              </span>
            </div>

            {/* Kitchen Printer */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${kitchenPrinter?.status === 'offline' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                <div className="truncate">
                  <p className="font-semibold text-slate-900 truncate">
                    Kitchen: {kitchenPrinter ? kitchenPrinter.name : 'LAN Printer'}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-emerald-600" /> {kitchenPrinter?.ipAddress || '192.168.1.100'}:9100
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                kitchenPrinter?.status === 'offline'
                  ? 'text-rose-700 bg-rose-100'
                  : 'text-emerald-700 bg-emerald-100/80'
              }`}>
                {kitchenPrinter?.status === 'offline' ? 'Offline' : 'Online'}
              </span>
            </div>

            {/* Bar Printer */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${barPrinter?.status === 'offline' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                <div className="truncate">
                  <p className="font-semibold text-slate-900 truncate">
                    Bar: {barPrinter ? barPrinter.name : 'LAN Drink Station'}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-emerald-600" /> {barPrinter?.ipAddress || '192.168.1.102'}:9100
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                barPrinter?.status === 'offline'
                  ? 'text-rose-700 bg-rose-100'
                  : 'text-emerald-700 bg-emerald-100/80'
              }`}>
                {barPrinter?.status === 'offline' ? 'Offline' : 'Online'}
              </span>
            </div>
          </div>

          {/* Active Job Notice if any */}
          {activeJobs.length > 0 && (
            <div className="mx-3 mb-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
              <span>{activeJobs.length} print job(s) in active spooler</span>
            </div>
          )}

          {/* Footer Action */}
          <div className="px-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setIsOpen(false);
                setActiveRoute('settings');
              }}
              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Manage Printers & Routing</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
