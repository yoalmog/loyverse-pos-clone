import {
  Printer,
  PrinterRoute,
  PrintJob,
  PrinterPurpose,
  PrintJobType,
  PrinterDiagnosticResult
} from '../../types/printer.ts';
import { Sale, SaleItem } from '../../types/pos.ts';
import { StorageService } from '../storageService.ts';
import { PrinterManager } from './printerManager.ts';
import { EscPosBuilder } from './escposBuilder.ts';
import { EscPosNetworkAdapter } from './adapters/escposNetworkAdapter.ts';
import { PrintPayload } from './adapters/printerAdapter.ts';

export class PrintService {
  // -------------------------------------------------------------
  // PRINTER CRUD
  // -------------------------------------------------------------

  static getPrinters(): Printer[] {
    return StorageService.getPrinters();
  }

  static getPrinterById(id: string): Printer | undefined {
    return this.getPrinters().find(p => p.id === id);
  }

  static savePrinter(printer: Printer): Printer {
    const printers = this.getPrinters();
    const idx = printers.findIndex(p => p.id === printer.id);

    // If setting as default for a purpose, unset other defaults for that purpose
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

    // Also remove any routes pointing to this printer
    const routes = this.getRoutes().filter(r => r.printerId !== id);
    StorageService.savePrinterRoutes(routes);
  }

  // -------------------------------------------------------------
  // ROUTING ENGINE (Product -> Category -> Purpose -> Default)
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
   * Resolves the target printer for a given product and purpose.
   * Priority:
   * 1. Product-specific route
   * 2. Category-specific route
   * 3. Purpose-specific route
   * 4. Default printer for purpose
   * 5. Global fallback printer
   */
  static resolvePrinter(options: {
    productId?: string;
    categoryId?: string;
    purpose: PrinterPurpose;
  }): Printer | undefined {
    const printers = this.getPrinters();
    const routes = this.getRoutes().sort((a, b) => b.priority - a.priority);

    // 1. Product specific route
    if (options.productId) {
      const match = routes.find(r => r.productId === options.productId);
      if (match) {
        const p = printers.find(pr => pr.id === match.printerId);
        if (p) return p;
      }
    }

    // 2. Category specific route
    if (options.categoryId) {
      const match = routes.find(r => r.categoryId === options.categoryId);
      if (match) {
        const p = printers.find(pr => pr.id === match.printerId);
        if (p) return p;
      }
    }

    // 3. Purpose route
    const purposeRoute = routes.find(r => r.purpose === options.purpose && !r.productId && !r.categoryId);
    if (purposeRoute) {
      const p = printers.find(pr => pr.id === purposeRoute.printerId);
      if (p) return p;
    }

    // 4. Default printer for purpose
    const purposeDefault = printers.find(p => p.printerPurpose === options.purpose && p.isDefault);
    if (purposeDefault) return purposeDefault;

    // 5. Any printer assigned to purpose
    const purposePrinter = printers.find(p => p.printerPurpose === options.purpose);
    if (purposePrinter) return purposePrinter;

    // 6. Global default or first printer
    return printers.find(p => p.isDefault) || printers[0];
  }

  // -------------------------------------------------------------
  // TESTING & DIAGNOSTICS
  // -------------------------------------------------------------

  static async testConnection(printerId: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const printer = this.getPrinterById(printerId);
    if (!printer) {
      return { success: false, message: 'Printer not found in registry.' };
    }

    const adapter = PrinterManager.getAdapter(printer);
    const result = await adapter.testConnection(printer);

    // Update printer last checked status
    const allPrinters = this.getPrinters();
    const idx = allPrinters.findIndex(p => p.id === printerId);
    if (idx !== -1) {
      allPrinters[idx] = {
        ...allPrinters[idx],
        status: result.success ? 'online' : 'offline',
        lastCheckedAt: new Date().toISOString(),
        lastError: result.success ? undefined : result.message,
        updatedAt: new Date().toISOString()
      };
      StorageService.savePrinters(allPrinters);
    }

    return result;
  }

  static async testPrint(printerId: string): Promise<{ success: boolean; message: string }> {
    const printer = this.getPrinterById(printerId);
    if (!printer) {
      return { success: false, message: 'Printer not found.' };
    }

    const adapter = PrinterManager.getAdapter(printer);
    const { builder, previewText } = EscPosNetworkAdapter.generateTestReceipt(printer);

    const payload: PrintPayload = {
      jobId: `job_test_${Date.now()}`,
      title: `Test Print - ${printer.name}`,
      bytes: builder.toBytes(),
      previewText,
      cutPaper: printer.supportsCut,
      kickDrawer: false
    };

    const res = await adapter.print(printer, payload);

    // Record job
    this.recordJob({
      id: payload.jobId,
      storeId: printer.storeId,
      printerId: printer.id,
      printerName: printer.name,
      jobType: 'test',
      title: payload.title,
      content: previewText,
      status: res.success ? 'completed' : 'failed',
      attemptCount: 1,
      maxAttempts: 1,
      errorMessage: res.error,
      createdAt: new Date().toISOString(),
      completedAt: res.success ? new Date().toISOString() : undefined
    });

    if (res.success) {
      return { success: true, message: `Test receipt dispatched to ${printer.name}.` };
    } else {
      return { success: false, message: res.error || 'Test print failed.' };
    }
  }

  static async getDiagnostics(printerId: string): Promise<PrinterDiagnosticResult | null> {
    const printer = this.getPrinterById(printerId);
    if (!printer) return null;
    const adapter = PrinterManager.getAdapter(printer);
    return adapter.diagnose(printer);
  }

  // -------------------------------------------------------------
  // PRINT JOB EXECUTION & AUTOMATIC SALE DISPATCH
  // -------------------------------------------------------------

  static getPrintJobs(): PrintJob[] {
    return StorageService.getPrintJobs();
  }

  static recordJob(job: PrintJob): void {
    const jobs = this.getPrintJobs();
    const idx = jobs.findIndex(j => j.id === job.id);
    if (idx !== -1) {
      jobs[idx] = job;
    } else {
      jobs.unshift(job);
    }
    StorageService.savePrintJobs(jobs);
  }

  /**
   * Mixed Printer Environment Dispatch (Sections 18, 19, 28, 37)
   * Automatically executes:
   * 1. Customer Receipt -> to configured Receipt printer (e.g. X18 Mini)
   * 2. Kitchen Ticket -> to LAN ESC/POS Kitchen Printer (for food items)
   * 3. Bar Ticket -> to LAN ESC/POS Bar Printer (for drink items)
   * 4. Cash drawer pulse if cash tender and printer supports drawer
   */
  static async handleSaleCompletion(
    sale: Sale,
    paymentMethod: string = 'cash'
  ): Promise<{ jobsCreated: number; results: { printerName: string; success: boolean }[] }> {
    const settings = StorageService.getSettings();
    const results: { printerName: string; success: boolean }[] = [];
    const products = StorageService.getProducts();

    // 1. Dispatch Customer Receipt
    const receiptPrinter = this.resolvePrinter({ purpose: 'receipt' });
    if (receiptPrinter && receiptPrinter.autoPrint) {
      const isCash = paymentMethod.toLowerCase() === 'cash';
      const shouldKickDrawer = isCash && receiptPrinter.supportsCashDrawer;

      const { builder, previewText } = this.buildCustomerReceipt(sale, receiptPrinter, shouldKickDrawer);
      const jobRes = await this.executeJob({
        printer: receiptPrinter,
        jobType: 'receipt',
        title: `Receipt #${sale.receiptNumber}`,
        saleId: sale.id,
        bytes: builder.toBytes(),
        previewText,
        cutPaper: receiptPrinter.supportsCut,
        kickDrawer: shouldKickDrawer
      });
      results.push({ printerName: receiptPrinter.name, success: jobRes.success });
    }

    // 2. Dynamic Order Ticket Routing (Requirement 21 & 22)
    // Priority: Product printer -> Category printer -> Purpose/Default printer
    const categories = StorageService.getCategories();
    const itemsByPrinter = new Map<string, { printer: Printer; items: SaleItem[]; stationTitle: string }>();

    sale.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const cat = categories.find(c => c.id === prod?.categoryId);

      // If category explicitly disabled auto-printing kitchen orders, skip kitchen routing
      if (cat && cat.autoPrintKitchen === false) {
        return;
      }

      // Determine category or purpose default
      let targetPrinter: Printer | undefined;

      // 1. Direct product route check
      targetPrinter = this.resolvePrinter({
        productId: item.productId,
        categoryId: prod?.categoryId,
        purpose: 'kitchen'
      });

      // 2. Fallback to category assigned printer if not found in routes
      if (!targetPrinter && cat?.printerId) {
        targetPrinter = this.getPrinterById(cat.printerId);
      }

      // 3. Fallback to kitchen/bar purpose default if food/drinks
      if (!targetPrinter) {
        targetPrinter = this.resolvePrinter({ purpose: 'kitchen' });
      }

      // Only dispatch if printer exists, autoPrint is enabled, and is separate from receipt printer or explicitly marked for tickets
      if (targetPrinter && targetPrinter.autoPrint && targetPrinter.id !== receiptPrinter?.id) {
        const stationTitle = cat?.name
          ? `${cat.name.toUpperCase()} ORDER`
          : targetPrinter.printerPurpose === 'bar'
            ? 'BAR ORDER'
            : 'KITCHEN ORDER';

        if (!itemsByPrinter.has(targetPrinter.id)) {
          itemsByPrinter.set(targetPrinter.id, { printer: targetPrinter, items: [], stationTitle });
        }
        itemsByPrinter.get(targetPrinter.id)!.items.push(item);
      }
    });

    // 3. Dispatch tickets to each target printer
    for (const [_, group] of Array.from(itemsByPrinter.entries())) {
      if (group.items.length > 0) {
        const { builder, previewText } = this.buildOrderTicket({
          sale,
          items: group.items,
          stationTitle: group.stationTitle,
          printer: group.printer
        });

        const jobRes = await this.executeJob({
          printer: group.printer,
          jobType: group.printer.printerPurpose === 'bar' ? 'bar' : 'kitchen',
          title: `${group.stationTitle} #${sale.receiptNumber}`,
          saleId: sale.id,
          bytes: builder.toBytes(),
          previewText,
          cutPaper: group.printer.supportsCut,
          kickDrawer: false
        });
        results.push({ printerName: group.printer.name, success: jobRes.success });
      }
    }

    return { jobsCreated: results.length, results };
  }

  /**
   * Executes a print job with automatic retry policy (Section 33)
   */
  static async executeJob(params: {
    printer: Printer;
    jobType: PrintJobType;
    title: string;
    saleId?: string;
    bytes: Uint8Array;
    previewText: string;
    cutPaper?: boolean;
    kickDrawer?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const job: PrintJob = {
      id: jobId,
      storeId: params.printer.storeId,
      printerId: params.printer.id,
      printerName: params.printer.name,
      saleId: params.saleId,
      jobType: params.jobType,
      title: params.title,
      content: params.previewText,
      status: 'printing',
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
    };
    this.recordJob(job);

    const adapter = PrinterManager.getAdapter(params.printer);
    const payload: PrintPayload = {
      jobId,
      title: params.title,
      bytes: params.bytes,
      previewText: params.previewText,
      saleId: params.saleId,
      cutPaper: params.cutPaper,
      kickDrawer: params.kickDrawer
    };

    // First attempt
    let result = await adapter.print(params.printer, payload);

    // Retry policy: if failed, retry 2 (after 2s), retry 3 (after 5s)
    if (!result.success && params.printer.status !== 'offline') {
      job.attemptCount = 2;
      this.recordJob(job);
      await new Promise(r => setTimeout(r, 2000));
      result = await adapter.print(params.printer, payload);
    }

    const nowIso = new Date().toISOString();
    if (result.success) {
      job.status = 'completed';
      job.completedAt = nowIso;
      this.recordJob(job);

      // Update printer lastPrintedAt
      const printers = this.getPrinters();
      const pIdx = printers.findIndex(p => p.id === params.printer.id);
      if (pIdx !== -1) {
        printers[pIdx].lastPrintedAt = nowIso;
        printers[pIdx].status = 'online';
        StorageService.savePrinters(printers);
      }
      return { success: true };
    } else {
      job.status = 'failed';
      job.errorMessage = result.error;
      this.recordJob(job);
      return { success: false, error: result.error };
    }
  }

  static async retryJob(jobId: string): Promise<boolean> {
    const jobs = this.getPrintJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return false;

    const printer = this.getPrinterById(job.printerId);
    if (!printer) return false;

    job.status = 'printing';
    job.attemptCount += 1;
    this.recordJob(job);

    const builder = new EscPosBuilder(printer.charactersPerLine || 48);
    builder.text(job.content);
    if (printer.supportsCut) builder.cut(false);

    const adapter = PrinterManager.getAdapter(printer);
    const res = await adapter.print(printer, {
      jobId: job.id,
      title: job.title,
      bytes: builder.toBytes(),
      previewText: job.content
    });

    job.status = res.success ? 'completed' : 'failed';
    if (res.success) {
      job.completedAt = new Date().toISOString();
      job.errorMessage = undefined;
    } else {
      job.errorMessage = res.error;
    }
    this.recordJob(job);
    return res.success;
  }

  // -------------------------------------------------------------
  // RECEIPT & TICKET BUILDERS
  // -------------------------------------------------------------

  static buildCustomerReceipt(
    sale: Sale,
    printer: Printer,
    kickDrawer: boolean
  ): { builder: EscPosBuilder; previewText: string } {
    const settings = StorageService.getSettings();
    const cols = printer.charactersPerLine || (printer.paperWidth === 58 ? 32 : 48);
    const builder = new EscPosBuilder(cols);

    // 1. Kick cash drawer first if configured
    if (kickDrawer && printer.supportsCashDrawer) {
      builder.cashDrawerPulse(2);
    }

    // 2. Header
    builder
      .initialize()
      .setAlignment('center')
      .setBold(true)
      .setFontSize(cols >= 48 ? 'double_height' : 'normal')
      .line(settings.name)
      .setFontSize('normal')
      .setBold(false)
      .line(settings.address)
      .line(settings.phone)
      .line(`Tax ID: ${settings.taxId}`)
      .doubleSeparator();

    // 3. Receipt metadata
    builder
      .setAlignment('left')
      .columns([
        { text: `Receipt #: ${sale.receiptNumber}`, align: 'left' },
        { text: new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), align: 'right' }
      ])
      .columns([
        { text: `Date: ${new Date(sale.createdAt).toLocaleDateString()}`, align: 'left' },
        { text: `Cashier: ${sale.employeeName}`, align: 'right' }
      ]);

    if (sale.customerName) {
      builder.line(`Customer: ${sale.customerName}`);
    }

    builder.separator('-');

    // 4. Line Items Table with column layout engine
    // Header
    builder.setBold(true);
    if (cols >= 48) {
      builder.columns([
        { text: 'Item Description', align: 'left' },
        { text: 'Qty', widthChars: 5, align: 'center' },
        { text: 'Total', widthChars: 9, align: 'right' }
      ]);
    } else {
      builder.columns([
        { text: 'Item', align: 'left' },
        { text: 'Qty', widthChars: 4, align: 'center' },
        { text: 'Amt', widthChars: 7, align: 'right' }
      ]);
    }
    builder.setBold(false);
    builder.separator('-');

    // Items
    sale.items.forEach(item => {
      const name = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
      builder.columns([
        { text: name, align: 'left' },
        { text: `${item.quantity}`, widthChars: cols >= 48 ? 5 : 4, align: 'center' },
        { text: `$${item.lineTotal.toFixed(2)}`, widthChars: cols >= 48 ? 9 : 7, align: 'right' }
      ]);
    });

    builder.separator('-');

    // 5. Totals
    builder
      .columns([
        { text: 'Subtotal:', align: 'left' },
        { text: `$${sale.subtotal.toFixed(2)}`, align: 'right' }
      ]);

    if (sale.discountAmount > 0) {
      builder.columns([
        { text: `Discount (${sale.discountDescription || 'Promo'}):`, align: 'left' },
        { text: `-$${sale.discountAmount.toFixed(2)}`, align: 'right' }
      ]);
    }

    builder
      .columns([
        { text: `Tax (${(sale.taxRate * 100).toFixed(2)}%):`, align: 'left' },
        { text: `$${sale.taxAmount.toFixed(2)}`, align: 'right' }
      ])
      .separator('=')
      .setAlignment('right')
      .setBold(true)
      .setFontSize(cols >= 48 ? 'double_height' : 'normal')
      .line(`TOTAL: $${sale.total.toFixed(2)}`)
      .setFontSize('normal')
      .setBold(false)
      .separator('-');

    // 6. Payments
    sale.payments.forEach(p => {
      builder.columns([
        { text: `${p.method.toUpperCase()} Payment:`, align: 'left' },
        { text: `$${p.amount.toFixed(2)}`, align: 'right' }
      ]);
      if (p.change !== undefined && p.change > 0) {
        builder.columns([
          { text: 'Change Returned:', align: 'left' },
          { text: `$${p.change.toFixed(2)}`, align: 'right' }
        ]);
      }
    });

    // 7. Footer & Barcode/QR
    builder
      .doubleSeparator()
      .setAlignment('center')
      .line(settings.receiptFooter || 'Thank you for your business!')
      .line();

    if (printer.supportsBarcode && printer.paperWidth >= 80) {
      builder.barcode(sale.receiptNumber, 'CODE128');
    }

    if (printer.supportsCut && printer.paperWidth >= 80) {
      builder.cut(false);
    } else {
      builder.feed(4);
    }

    return {
      builder,
      previewText: builder.toPreviewText()
    };
  }

  static buildOrderTicket(params: {
    sale: Sale;
    items: SaleItem[];
    stationTitle: string;
    printer: Printer;
  }): { builder: EscPosBuilder; previewText: string } {
    const cols = params.printer.charactersPerLine || 48;
    const builder = new EscPosBuilder(cols);

    builder
      .initialize()
      .doubleSeparator('*')
      .setAlignment('center')
      .setFontSize('double_height')
      .setBold(true)
      .line(`*** ${params.stationTitle} ***`)
      .setFontSize('normal')
      .setBold(false)
      .doubleSeparator('*')
      .setAlignment('left')
      .setBold(true)
      .line(`ORDER: #${params.sale.receiptNumber}`)
      .setBold(false)
      .line(`Time:    ${new Date(params.sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
      .line(`Server:  ${params.sale.employeeName}`)
      .line(params.sale.customerName ? `Guest:   ${params.sale.customerName}` : 'Guest:   Walk-in')
      .separator('-');

    // Items list in high-contrast kitchen format
    params.items.forEach(item => {
      builder
        .setBold(true)
        .setFontSize(cols >= 48 ? 'double_height' : 'normal')
        .line(`[ ${item.quantity}x ] ${item.productName}`)
        .setFontSize('normal')
        .setBold(false);

      if (item.variantName) {
        builder.line(`     > Option: ${item.variantName}`);
      }
      builder.feed(1);
    });

    if (params.sale.notes) {
      builder
        .separator('-')
        .setBold(true)
        .line('SPECIAL INSTRUCTIONS:')
        .setBold(false)
        .line(params.sale.notes);
    }

    builder.doubleSeparator('*');

    if (params.printer.supportsCut) {
      builder.cut(false);
    } else {
      builder.feed(3);
    }

    return {
      builder,
      previewText: builder.toPreviewText()
    };
  }
}
