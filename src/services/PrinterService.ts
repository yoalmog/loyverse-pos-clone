/**
 * Unified Printer Service & Hardware Adapter System
 * Implements: POS -> PrinterService -> PrinterAdapter Architecture
 * Decouples checkout and POS logic from Bluetooth, USB, TCP sockets, or ESC/POS protocols.
 */

import {
  Printer,
  PrinterRoute,
  PrintJob,
  PrinterPurpose,
  PrinterDiagnosticResult
} from '../types/printer.ts';
import { Sale, SaleItem } from '../types/pos.ts';
import { StorageService } from './storageService.ts';
import { EscPosGenerator } from '../utils/EscPosGenerator.ts';
import { X18BluetoothAdapter } from './printer/adapters/x18BluetoothAdapter.ts';
import { EscPosNetworkAdapter } from './printer/adapters/escposNetworkAdapter.ts';
import { X18USBAdapter } from './printer/adapters/x18UsbAdapter.ts';
import { BrowserPrintAdapter } from './printer/adapters/browserPrintAdapter.ts';
import { BuiltinPrinterAdapter } from './printer/adapters/builtinPrinterAdapter.ts';
import { NativeBridgeService } from './native/NativeBridgeService.ts';

// -------------------------------------------------------------
// BASE ADAPTER INTERFACES
// -------------------------------------------------------------

export interface AdapterTestResult {
  success: boolean;
  latencyMs?: number;
  message: string;
  error?: string;
}

export interface PrintPayload {
  jobId: string;
  title: string;
  bytes: Uint8Array;
  previewText: string;
  saleId?: string;
  cutPaper?: boolean;
  kickDrawer?: boolean;
}

export interface PrinterAdapter {
  readonly adapterName: string;
  testConnection(printer: Printer): Promise<AdapterTestResult>;
  print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }>;
  diagnose?(printer: Printer): Promise<PrinterDiagnosticResult>;
}

// -------------------------------------------------------------
// UNIFIED PRINTER SERVICE
// -------------------------------------------------------------

export class PrinterService {
  private static x18BluetoothAdapter = new X18BluetoothAdapter();
  private static escPosNetworkAdapter = new EscPosNetworkAdapter();
  private static x18UsbAdapter = new X18USBAdapter();
  private static browserPrintAdapter = new BrowserPrintAdapter();
  private static builtinPrinterAdapter = new BuiltinPrinterAdapter();

  /**
   * Adapter Factory: Resolves the appropriate PrinterAdapter based on printer hardware config.
   * Isolates the rest of the application from underlying protocol specifics.
   */
  static getAdapter(printer: Printer): PrinterAdapter {
    if (
      printer.connectionType === 'builtin' ||
      printer.printerType === 'builtin' ||
      printer.printerType === 'sunmi'
    ) {
      return this.builtinPrinterAdapter;
    }
    if (
      printer.printerType === 'x18' ||
      printer.printerType === 'x6' ||
      printer.printerType === 'cat' ||
      printer.connectionType === 'bluetooth' ||
      printer.protocol === 'X6H_BLE'
    ) {
      return this.x18BluetoothAdapter;
    }
    if (printer.connectionType === 'lan' || printer.printerType === 'escpos') {
      return this.escPosNetworkAdapter;
    }
    if (printer.connectionType === 'usb' || printer.printerType === 'usb') {
      return this.x18UsbAdapter;
    }
    return this.browserPrintAdapter;
  }

  // -------------------------------------------------------------
  // PRINTER CRUD OPERATIONS
  // -------------------------------------------------------------

  static getPrinters(): Printer[] {
    const list = StorageService.getPrinters();
    if (list.length > 0) {
      return list;
    }

    // Auto-discover and register native hardware printer if running on Android POS
    if (typeof window !== 'undefined' && NativeBridgeService.isNativeAndroid()) {
      try {
        // 1. Built-in Terminal Printer (Sunmi / Handheld POS)
        const builtIn = NativeBridgeService.printer.getBuiltInPrinter();
        if (builtIn) {
          const autoPrn: Printer = {
            id: 'prn_builtin_auto',
            storeId: 'store_1',
            name: builtIn.name || 'Integrated Terminal Printer',
            model: 'Built-in Thermal Head',
            printerType: 'builtin',
            connectionType: 'builtin',
            protocol: 'SUNMI',
            paperWidth: 58,
            charactersPerLine: 32,
            encoding: 'CP437',
            isDefault: true,
            printerPurpose: 'receipt',
            autoPrint: true,
            supportsCut: false,
            supportsCashDrawer: true,
            supportsQr: false,
            supportsBarcode: false,
            status: 'connected',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          StorageService.savePrinter(autoPrn);
          return [autoPrn];
        }

        // 2. Paired Bluetooth Devices
        const paired = NativeBridgeService.printer.getPairedBluetoothDevices();
        if (paired.length > 0) {
          const first = paired[0];
          const isCat = (first.name || '').toLowerCase().match(/x6|x5|cat|c9|tiny|walk|gb0|mx0|iprint|peripage/);
          const autoPrn: Printer = {
            id: `prn_bt_${first.address || first.id}`,
            storeId: 'store_1',
            name: first.name || (isCat ? 'X6h-0000' : 'Bluetooth Receipt Printer'),
            model: isCat ? 'Cat / X6 Mini BLE Printer' : 'ESC/POS Bluetooth Thermal',
            printerType: isCat ? 'x6' : 'x18',
            connectionType: 'bluetooth',
            protocol: isCat ? 'X6H_BLE' : 'ESC_POS',
            deviceIdentifier: first.address || first.id,
            paperWidth: 58,
            charactersPerLine: 32,
            encoding: 'CP437',
            isDefault: true,
            printerPurpose: 'receipt',
            autoPrint: true,
            supportsCut: false,
            supportsCashDrawer: false,
            supportsQr: false,
            supportsBarcode: false,
            status: 'connected',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          StorageService.savePrinter(autoPrn);
          return [autoPrn];
        }
      } catch (e) {
        console.warn('Auto-printer registration error:', e);
      }
    }

    return list;
  }

  static getPrinterById(id: string): Printer | undefined {
    return this.getPrinters().find(p => p.id === id);
  }

  static savePrinter(printer: Printer): Printer {
    const printers = this.getPrinters();
    const idx = printers.findIndex(p => p.id === printer.id);

    // If marked default for a purpose, clear other defaults for that same purpose
    if (printer.isDefault) {
      printers.forEach(p => {
        if (p.printerPurpose === printer.printerPurpose && p.id !== printer.id) {
          p.isDefault = false;
        }
      });
    }

    if (idx !== -1) {
      printers[idx] = { ...printer, updatedAt: new Date().toISOString() };
    } else {
      printers.unshift(printer);
    }

    StorageService.savePrinters(printers);
    return printer;
  }

  static deletePrinter(id: string): void {
    const printers = this.getPrinters().filter(p => p.id !== id);
    StorageService.savePrinters(printers);

    // Clean up associated routes
    const routes = this.getRoutes().filter(r => r.printerId !== id);
    StorageService.savePrinterRoutes(routes);
  }

  // -------------------------------------------------------------
  // ROUTING ENGINE
  // -------------------------------------------------------------

  static getRoutes(): PrinterRoute[] {
    return StorageService.getPrinterRoutes();
  }

  static saveRoute(route: PrinterRoute): PrinterRoute {
    const routes = this.getRoutes();
    const idx = routes.findIndex(r => r.id === route.id);
    if (idx !== -1) {
      routes[idx] = { ...route, updatedAt: new Date().toISOString() };
    } else {
      routes.unshift(route);
    }
    StorageService.savePrinterRoutes(routes);
    return route;
  }

  static deleteRoute(id: string): void {
    const routes = this.getRoutes().filter(r => r.id !== id);
    StorageService.savePrinterRoutes(routes);
  }

  /**
   * Resolves the target printer for a given product or purpose.
   * Priority: Product -> Category -> Purpose -> Default -> Global Fallback
   */
  static resolvePrinter(options: {
    productId?: string;
    categoryId?: string;
    purpose: PrinterPurpose;
  }): Printer | undefined {
    const printers = this.getPrinters();
    if (printers.length === 0) return undefined;

    const routes = this.getRoutes().sort((a, b) => b.priority - a.priority);

    // 1. Product-level route
    if (options.productId) {
      const productRoute = routes.find(r => r.productId === options.productId);
      if (productRoute) {
        const found = printers.find(p => p.id === productRoute.printerId);
        if (found) return found;
      }
    }

    // 2. Category-level route
    if (options.categoryId) {
      const catRoute = routes.find(r => r.categoryId === options.categoryId);
      if (catRoute) {
        const found = printers.find(p => p.id === catRoute.printerId);
        if (found) return found;
      }
    }

    // 3. Purpose route
    const purposeRoute = routes.find(r => r.purpose === options.purpose && !r.productId && !r.categoryId);
    if (purposeRoute) {
      const found = printers.find(p => p.id === purposeRoute.printerId);
      if (found) return found;
    }

    // 4. Default printer for purpose
    const defaultForPurpose = printers.find(p => p.printerPurpose === options.purpose && p.isDefault);
    if (defaultForPurpose) return defaultForPurpose;

    // 5. Match by purpose
    const purposeMatch = printers.find(p => p.printerPurpose === options.purpose);
    if (purposeMatch) return purposeMatch;

    // 6. Global default or first available
    return printers.find(p => p.isDefault) || printers[0];
  }

  // -------------------------------------------------------------
  // TEST & DIAGNOSTIC METHODS
  // -------------------------------------------------------------

  /**
   * Test connection to a printer via its adapter
   */
  static async testConnection(printer: Printer): Promise<AdapterTestResult> {
    const adapter = this.getAdapter(printer);
    const result = await adapter.testConnection(printer);

    // Update printer last checked time & status
    const printers = this.getPrinters();
    const target = printers.find(p => p.id === printer.id);
    if (target) {
      target.lastCheckedAt = new Date().toISOString();
      if (!result.success) {
        target.lastError = result.message;
      } else {
        target.lastError = undefined;
      }
      StorageService.savePrinters(printers);
    }

    return result;
  }

  /**
   * Send a formatted test receipt to verify print head, feeding, and cutter
   */
  static async testPrint(printer: Printer): Promise<{ success: boolean; error?: string; previewText?: string }> {
    const isX6h = (printer.name || '').toLowerCase().includes('x6') ||
                  (printer.model || '').toLowerCase().includes('x6') ||
                  (printer.model || '').toLowerCase().includes('cat') ||
                  printer.protocol === 'X6H_BLE' ||
                  printer.printerType === 'x6' ||
                  printer.printerType === 'cat';

    const cols = printer.charactersPerLine || (printer.paperWidth === 58 ? 32 : 48);
    const gen = new EscPosGenerator(cols);

    if (isX6h) {
      gen
        .initialize()
        .doubleSeparator('=')
        .setAlignment('center')
        .setBold(true)
        .line('AURAPOS TEST PRINT')
        .setBold(false)
        .doubleSeparator('=')
        .setAlignment('left')
        .line(`Printer:  ${printer.name || 'X6h-0000'}`)
        .line('Protocol: X6H BLE')
        .line('BLE:      CONNECTED')
        .line('PRINT TEST: OK')
        .doubleSeparator('=')
        .feed(2);
    } else {
      gen
        .initialize()
        .doubleSeparator('=')
        .setAlignment('center')
        .setBold(true)
        .setFontSize(cols >= 48 ? 'double_height' : 'normal')
        .line('POS PRINTER TEST')
        .setFontSize('normal')
        .setBold(false)
        .doubleSeparator('=')
        .setAlignment('left')
        .line(`Printer:  ${printer.name}`)
        .line(`Model:    ${printer.model}`)
        .line(`Type:     ${printer.printerType.toUpperCase()} / ${printer.connectionType.toUpperCase()}`);

      if (printer.ipAddress) {
        gen.line(`IP:       ${printer.ipAddress}`);
        gen.line(`Port:     ${printer.port || 9100}`);
      } else if (printer.deviceIdentifier) {
        gen.line(`Device:   ${printer.deviceIdentifier}`);
      }

      gen
        .line(`Paper:    ${printer.paperWidth} mm (${cols} cols)`)
        .line(`Time:     ${new Date().toLocaleTimeString()}`)
        .separator('-')
        .setAlignment('center')
        .setBold(true)
        .line('✓ TEST PRINT SUCCESSFUL')
        .setBold(false)
        .doubleSeparator('=');

      // Barcode test - only for 80mm desktop printers with verified 1D barcode hardware
      if (printer.supportsBarcode && printer.paperWidth >= 80) {
        gen.feed(1).barcode('TEST-9100', 'CODE128');
      }

      // Cut paper or advance paper past tear bar
      if (printer.supportsCut && printer.paperWidth >= 80) {
        gen.cut(false);
      } else {
        gen.feed(4);
      }
    }

    const payload: PrintPayload = {
      jobId: `test_${Date.now()}`,
      title: `Test Print: ${printer.name}`,
      bytes: gen.generate(),
      previewText: gen.toPreviewText(),
      cutPaper: printer.supportsCut
    };

    const adapter = this.getAdapter(printer);
    const result = await adapter.print(printer, payload);

    return {
      success: result.success,
      error: result.error,
      previewText: gen.toPreviewText()
    };
  }

  // -------------------------------------------------------------
  // POS UNIFIED PRINT RECEIPT METHOD
  // -------------------------------------------------------------

  /**
   * The single point-of-sale receipt printing method.
   * Resolves the configured receipt printer, translates the sale into ESC/POS bytes,
   * handles cash drawer kicks, automatic paper cutting, and delegates to the adapter.
   */
  static async printReceipt(
    receipt: Sale,
    options?: {
      printerId?: string;
      openDrawer?: boolean;
      cutPaper?: boolean;
    }
  ): Promise<{ success: boolean; error?: string; previewText?: string; jobId?: string }> {
    try {
      // 1. Resolve printer
      let printer = options?.printerId ? this.getPrinterById(options.printerId) : undefined;
      if (!printer) {
        printer = this.resolvePrinter({ purpose: 'receipt' });
      }

      if (!printer) {
        return {
          success: false,
          error: 'No hardware printer configured. Please add a printer in Printer Settings.'
        };
      }

      // 2. Generate ESC/POS byte sequence via EscPosGenerator
      const { generator, previewText } = this.buildReceiptBytes(receipt, printer, options);
      const bytes = generator.generate();

      // 3. Create print payload
      const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const payload: PrintPayload = {
        jobId,
        title: `Receipt #${receipt.receiptNumber}`,
        bytes,
        previewText,
        saleId: receipt.id,
        cutPaper: options?.cutPaper ?? printer.supportsCut,
        kickDrawer: options?.openDrawer ?? (printer.supportsCashDrawer && receipt.payments.some(p => p.method === 'cash'))
      };

      // 4. Log print job to spooler queue
      const job: PrintJob = {
        id: jobId,
        storeId: printer.storeId || 'store_1',
        printerId: printer.id,
        printerName: printer.name,
        saleId: receipt.id,
        jobType: 'receipt',
        title: payload.title,
        content: previewText,
        status: 'queued',
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString()
      };

      const jobs = StorageService.getPrintJobs();
      jobs.unshift(job);
      StorageService.savePrintJobs(jobs);

      // 5. Select adapter and send to hardware
      const adapter = this.getAdapter(printer);
      const res = await adapter.print(printer, payload);

      // Update job status
      const updatedJobs = StorageService.getPrintJobs();
      const currentJob = updatedJobs.find(j => j.id === jobId);
      if (currentJob) {
        if (res.success) {
          currentJob.status = 'completed';
          currentJob.completedAt = new Date().toISOString();
        } else {
          currentJob.status = 'failed';
          currentJob.errorMessage = res.error;
        }
        StorageService.savePrintJobs(updatedJobs);
      }

      // Update printer last printed at
      const printers = this.getPrinters();
      const pIdx = printers.findIndex(p => p.id === printer!.id);
      if (pIdx !== -1) {
        printers[pIdx].lastPrintedAt = new Date().toISOString();
        StorageService.savePrinters(printers);
      }

      return {
        success: res.success,
        error: res.error,
        previewText,
        jobId
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Print receipt failed'
      };
    }
  }

  /**
   * Helper: Builds formatted ESC/POS byte sequence and preview text for a sale
   */
  static buildReceiptBytes(
    sale: Sale,
    printer: Printer,
    options?: { openDrawer?: boolean; cutPaper?: boolean }
  ): { generator: EscPosGenerator; previewText: string } {
    const cols = printer.charactersPerLine || (printer.paperWidth === 58 ? 32 : 48);
    const gen = new EscPosGenerator(cols);
    const settings = StorageService.getSettings();

    // Pulse cash drawer on cash transactions if supported
    const isCashSale = sale.payments.some(p => p.method === 'cash');
    if (options?.openDrawer || (printer.supportsCashDrawer && isCashSale)) {
      gen.cashDrawerPulse(2);
    }

    // Header
    gen
      .initialize()
      .setAlignment('center')
      .setFontSize(cols >= 48 ? 'double_height' : 'normal')
      .setBold(true)
      .line(settings.name || 'AURA POS')
      .setFontSize('normal')
      .setBold(false)
      .line(settings.address || '123 Main Street')
      .line(`${settings.city || 'San Francisco'}, ${settings.state || 'CA'} ${settings.zip || '94105'}`)
      .line(`Tel: ${settings.phone || '(555) 019-2834'}`);

    if (settings.taxId) {
      gen.line(`Tax ID: ${settings.taxId}`);
    }

    gen
      .doubleSeparator('=')
      .setAlignment('left')
      .line(`RECEIPT: #${sale.receiptNumber}`)
      .line(`DATE:    ${new Date(sale.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`)
      .line(`CASHIER: ${sale.employeeName}`);

    if (sale.customerName) {
      gen.line(`CLIENT:  ${sale.customerName}`);
    }

    gen.separator('-');

    // Columns: Item (wrapped) | Qty | Total
    const qtyColWidth = 4;
    const priceColWidth = 8;
    const itemColWidth = Math.max(8, cols - qtyColWidth - priceColWidth);

    gen.columns([
      { text: 'ITEM', width: itemColWidth, align: 'left' },
      { text: 'QTY', width: qtyColWidth, align: 'right' },
      { text: 'TOTAL', width: priceColWidth, align: 'right' }
    ]);
    gen.separator('-');

    // Line items
    sale.items.forEach(item => {
      const itemTitle = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
      const totalStr = `$${item.lineTotal.toFixed(2)}`;

      gen.columns([
        { text: itemTitle, width: itemColWidth, align: 'left' },
        { text: `${item.quantity}`, width: qtyColWidth, align: 'right' },
        { text: totalStr, width: priceColWidth, align: 'right' }
      ]);
    });

    gen.separator('-');

    // Totals
    const labelColWidth = cols - 12;
    const valueColWidth = 12;

    gen.columns([
      { text: 'Subtotal:', width: labelColWidth, align: 'right' },
      { text: `$${sale.subtotal.toFixed(2)}`, width: valueColWidth, align: 'right' }
    ]);

    if (sale.discountAmount > 0) {
      gen.columns([
        { text: `Discount (${sale.discountDescription || 'Promo'}):`, width: labelColWidth, align: 'right' },
        { text: `-$${sale.discountAmount.toFixed(2)}`, width: valueColWidth, align: 'right' }
      ]);
    }

    gen.columns([
      { text: `Sales Tax (${(sale.taxRate * 100).toFixed(1)}%):`, width: labelColWidth, align: 'right' },
      { text: `$${sale.taxAmount.toFixed(2)}`, width: valueColWidth, align: 'right' }
    ]);

    gen.separator('=');

    gen.setBold(true);
    gen.setFontSize(cols >= 48 ? 'double_height' : 'normal');
    gen.columns([
      { text: 'TOTAL:', width: labelColWidth, align: 'right' },
      { text: `$${sale.total.toFixed(2)}`, width: valueColWidth, align: 'right' }
    ]);
    gen.setFontSize('normal');
    gen.setBold(false);

    gen.separator('-');

    // Payments breakdown
    sale.payments.forEach(p => {
      const methodLabel = p.method.toUpperCase();
      gen.columns([
        { text: `Paid (${methodLabel}):`, width: labelColWidth, align: 'right' },
        { text: `$${p.amount.toFixed(2)}`, width: valueColWidth, align: 'right' }
      ]);
      if (p.tendered && p.change !== undefined) {
        gen.columns([
          { text: 'Tendered Cash:', width: labelColWidth, align: 'right' },
          { text: `$${p.tendered.toFixed(2)}`, width: valueColWidth, align: 'right' }
        ]);
        gen.columns([
          { text: 'Change Due:', width: labelColWidth, align: 'right' },
          { text: `$${p.change.toFixed(2)}`, width: valueColWidth, align: 'right' }
        ]);
      }
    });

    gen.separator('-');

    // Barcode / QR Code - only if 80mm paper to avoid crashing 58mm mobile thermal printers
    if (printer.supportsBarcode && printer.paperWidth >= 80) {
      gen.barcode(sale.receiptNumber, 'CODE128');
    }

    if (printer.supportsQr && printer.paperWidth >= 80) {
      gen.qrCode(`https://pos.store/verify/${sale.receiptNumber}`, 4);
    }

    // Footer
    gen
      .setAlignment('center')
      .line(settings.receiptFooter || 'Thank you for your business!')
      .line('Please retain this receipt for returns')
      .feed(2);

    // Paper cut or clean feed past tear bar
    if ((options?.cutPaper ?? printer.supportsCut) && printer.paperWidth >= 80) {
      gen.cut(false);
    } else {
      gen.feed(4);
    }

    return {
      generator: gen,
      previewText: gen.toPreviewText()
    };
  }
}
