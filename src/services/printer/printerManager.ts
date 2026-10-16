import { Printer } from '../../types/printer.ts';
import { PrinterAdapter } from './adapters/printerAdapter.ts';
import { X18BluetoothAdapter } from './adapters/x18BluetoothAdapter.ts';
import { X18USBAdapter } from './adapters/x18UsbAdapter.ts';
import { EscPosNetworkAdapter } from './adapters/escposNetworkAdapter.ts';
import { BrowserPrintAdapter } from './adapters/browserPrintAdapter.ts';
import { BuiltinPrinterAdapter } from './adapters/builtinPrinterAdapter.ts';

export class PrinterManager {
  private static adapters: Map<string, PrinterAdapter> = new Map<string, PrinterAdapter>([
    ['x18_bluetooth', new X18BluetoothAdapter()],
    ['x18_usb', new X18USBAdapter()],
    ['escpos_lan', new EscPosNetworkAdapter()],
    ['browser_browser', new BrowserPrintAdapter()],
    ['builtin_internal', new BuiltinPrinterAdapter()],
  ]);

  /**
   * Resolves the appropriate PrinterAdapter based on printer hardware & connection specs.
   * Isolates the rest of the application from underlying protocol specifics.
   */
  static getAdapter(printer: Printer): PrinterAdapter {
    const key = `${printer.printerType}_${printer.connectionType}`.toLowerCase();
    const adapter = this.adapters.get(key);

    if (adapter) {
      return adapter;
    }

    // 1. Built-in / Integrated POS terminal printer (Sunmi / Handheld POS)
    if (
      printer.connectionType === 'builtin' ||
      printer.printerType === 'builtin' ||
      printer.printerType === 'sunmi'
    ) {
      return this.adapters.get('builtin_internal')!;
    }

    // 2. Bluetooth connection fallback (matches ANY Bluetooth thermal printer: X18 Mini, POS-58, MPT-II, Cat, etc.)
    if (printer.connectionType === 'bluetooth' || printer.printerType === 'x18') {
      return this.adapters.get('x18_bluetooth')!;
    }

    // 3. USB connection fallback (matches ANY USB thermal printer)
    if (printer.connectionType === 'usb' || printer.printerType === 'usb') {
      return this.adapters.get('x18_usb')!;
    }

    // 4. LAN connection fallback (matches TCP 9100 ESC/POS network printers)
    if (printer.connectionType === 'lan' || printer.printerType === 'escpos') {
      return this.adapters.get('escpos_lan')!;
    }

    // 5. Host OS / System print spooler fallback
    return this.adapters.get('browser_browser')!;
  }

  /**
   * Register a custom or future adapter
   */
  static registerAdapter(key: string, adapter: PrinterAdapter): void {
    this.adapters.set(key.toLowerCase(), adapter);
  }
}
