import { PrintJob, PrintJobStatus, Printer } from '../../types/printer.ts';
import { Sale, SaleItem, CartItem, StoreSettings } from '../../types/pos.ts';
import { LocalDB } from '../db/localDatabase.ts';
import { StorageService } from '../storageService.ts';
import { NativeBridgeService } from '../native/NativeBridgeService.ts';
import { EscPosRenderer } from './escposRenderer.ts';

export type PersistentPrintJobStatus = 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PersistentPrintJob {
  id: string;
  storeId: string;
  printerId: string;
  printerName?: string;
  documentType: 'receipt' | 'kitchen' | 'bar' | 'refund' | 'test';
  referenceId?: string; // e.g. saleId or receiptNumber
  payload: string; // Base64 encoded ESC/POS raw bytes
  previewText?: string;
  status: PersistentPrintJobStatus;
  attempts: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export class PrintQueueService {
  private static isProcessing = false;
  private static listeners: Array<() => void> = [];

  static subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (_) {}
    });
  }

  /**
   * Get all persistent print jobs
   */
  static getQueue(): PersistentPrintJob[] {
    const raw = StorageService.getPrintJobs() as any[];
    // Normalize to upper case statuses
    return raw.map(j => ({
      ...j,
      documentType: j.documentType || j.jobType || 'receipt',
      referenceId: j.referenceId || j.saleId,
      payload: j.payload || j.rawCommands || '',
      status: (j.status || 'PENDING').toUpperCase() as PersistentPrintJobStatus,
      attempts: j.attempts !== undefined ? j.attempts : (j.attemptCount || 0),
      error: j.error || j.errorMessage
    }));
  }

  private static saveQueue(queue: PersistentPrintJob[]): void {
    StorageService.savePrintJobs(queue as any);
    this.notifyListeners();
  }

  /**
   * Enqueue a new print job into persistent storage
   */
  static enqueue(job: Omit<PersistentPrintJob, 'id' | 'createdAt' | 'attempts' | 'status'> & { id?: string }): PersistentPrintJob {
    const newJob: PersistentPrintJob = {
      id: job.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      storeId: job.storeId || 'store_aura_main',
      printerId: job.printerId,
      printerName: job.printerName,
      documentType: job.documentType,
      referenceId: job.referenceId,
      payload: job.payload,
      previewText: job.previewText,
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date().toISOString()
    };

    const current = this.getQueue();
    current.unshift(newJob);
    this.saveQueue(current);

    // Save to LocalDB IndexedDB
    LocalDB.put('print_jobs', newJob).catch(console.error);

    // Trigger immediate queue worker
    setTimeout(() => {
      this.processQueue();
    }, 50);

    return newJob;
  }

  /**
   * Resolve printer via Routing Rules (Section 17):
   * Product Printer -> Category Printer -> Default Printer -> Any Online Printer
   */
  static resolvePrinterForDocument(
    documentType: 'receipt' | 'kitchen' | 'bar' | 'refund',
    categoryId?: string,
    productId?: string
  ): { printer: Printer | null; reason?: string } {
    const printers = StorageService.getPrinters().filter(p => p.status !== 'unsupported');
    const routes = StorageService.getPrinterRoutes();

    if (printers.length === 0) {
      return { printer: null, reason: 'NO_PRINTERS_CONFIGURED' };
    }

    // 1. Check Product-level route
    if (productId) {
      const prodRoute = routes.find(r => r.productId === productId);
      if (prodRoute) {
        const found = printers.find(p => p.id === prodRoute.printerId);
        if (found) return { printer: found };
      }
    }

    // 2. Check Category-level route
    if (categoryId) {
      const catRoute = routes.find(r => r.categoryId === categoryId);
      if (catRoute) {
        const found = printers.find(p => p.id === catRoute.printerId);
        if (found) return { printer: found };
      }
    }

    // 3. Purpose match (kitchen, bar, receipt)
    const purposePrinter = printers.find(p => p.printerPurpose === documentType);
    if (purposePrinter) {
      return { printer: purposePrinter };
    }

    // 4. Default printer
    const defaultPrinter = printers.find(p => p.isDefault);
    if (defaultPrinter) {
      return { printer: defaultPrinter };
    }

    // 5. Fallback to first available printer
    return { printer: printers[0] };
  }

  /**
   * Auto-Print on Successful Sale (Section 12 & 13)
   * If printer is offline, sale STILL completes! Print job remains PENDING.
   */
  static enqueueSaleReceipt(
    sale: Sale,
    settings: StoreSettings,
    autoPrint: boolean = true
  ): { jobId: string; status: 'QUEUED' | 'NO_PRINTER' } {
    const { printer, reason } = this.resolvePrinterForDocument('receipt');

    if (!printer) {
      // Create job with PRINTER_NOT_CONFIGURED so it's not silently discarded (Section 17)
      const unconfiguredJob = this.enqueue({
        storeId: settings.id || 'store_aura_main',
        printerId: 'unconfigured',
        printerName: 'Unconfigured Printer',
        documentType: 'receipt',
        referenceId: sale.receiptNumber || sale.id,
        payload: '',
        previewText: `Receipt #${sale.receiptNumber} waiting for printer assignment.`,
        error: reason || 'PRINTER_NOT_CONFIGURED'
      });
      return { jobId: unconfiguredJob.id, status: 'NO_PRINTER' };
    }

    // Render ESC/POS bytes using unified renderer
    const { bytes, previewText } = EscPosRenderer.renderCustomerReceipt(sale, settings, {
      paperWidth: printer.paperWidth || 58,
      charactersPerLine: printer.charactersPerLine || (printer.paperWidth === 80 ? 48 : 32),
      cutPaper: printer.supportsCut,
      kickDrawer: printer.supportsCashDrawer && sale.payments.some(p => p.method === 'cash')
    });

    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binaryString);

    const job = this.enqueue({
      storeId: settings.id || 'store_aura_main',
      printerId: printer.id,
      printerName: printer.name,
      documentType: 'receipt',
      referenceId: sale.receiptNumber || sale.id,
      payload: base64Data,
      previewText
    });

    // Check station order routing for Kitchen / Bar items
    this.enqueueKitchenAndBarOrders(sale, settings);

    return { jobId: job.id, status: 'QUEUED' };
  }

  /**
   * Auto-Print station order tickets (Kitchen & Bar)
   */
  private static enqueueKitchenAndBarOrders(sale: Sale, settings: StoreSettings): void {
    const categories = StorageService.getCategories();
    const products = StorageService.getProducts();

    // Group items by category printer route
    const kitchenItems: SaleItem[] = [];
    const barItems: SaleItem[] = [];

    sale.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const cat = categories.find(c => c.id === prod?.categoryId);
      const catName = (cat?.name || '').toLowerCase();

      if (catName.includes('beverage') || catName.includes('bar') || catName.includes('drink') || catName.includes('coffee')) {
        barItems.push(item);
      } else {
        kitchenItems.push(item);
      }
    });

    if (kitchenItems.length > 0) {
      const { printer } = this.resolvePrinterForDocument('kitchen');
      if (printer) {
        const { bytes, previewText } = EscPosRenderer.renderStationTicket({
          title: 'Kitchen',
          receiptNumber: sale.receiptNumber || sale.id,
          createdAt: sale.createdAt,
          items: kitchenItems,
          charactersPerLine: printer.charactersPerLine || 32,
          cutPaper: printer.supportsCut
        });

        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) binaryString += String.fromCharCode(bytes[i]);

        this.enqueue({
          storeId: settings.id,
          printerId: printer.id,
          printerName: printer.name,
          documentType: 'kitchen',
          referenceId: sale.receiptNumber,
          payload: btoa(binaryString),
          previewText
        });
      }
    }

    if (barItems.length > 0) {
      const { printer } = this.resolvePrinterForDocument('bar');
      if (printer) {
        const { bytes, previewText } = EscPosRenderer.renderStationTicket({
          title: 'Bar / Beverage',
          receiptNumber: sale.receiptNumber || sale.id,
          createdAt: sale.createdAt,
          items: barItems,
          charactersPerLine: printer.charactersPerLine || 32,
          cutPaper: printer.supportsCut
        });

        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) binaryString += String.fromCharCode(bytes[i]);

        this.enqueue({
          storeId: settings.id,
          printerId: printer.id,
          printerName: printer.name,
          documentType: 'bar',
          referenceId: sale.receiptNumber,
          payload: btoa(binaryString),
          previewText
        });
      }
    }
  }

  /**
   * Main Queue Worker Processor
   * Recovers across app restarts, retries on failure, handles offline state.
   */
  static async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queue = this.getQueue();
      const pendingJobs = queue.filter(j => j.status === 'PENDING');

      for (const job of pendingJobs) {
        const printers = StorageService.getPrinters();
        const printer = printers.find(p => p.id === job.printerId);

        if (!printer) {
          job.status = 'FAILED';
          job.error = 'PRINTER_NOT_CONFIGURED';
          this.saveQueue(queue);
          continue;
        }

        // Mark as PRINTING
        job.status = 'PRINTING';
        job.startedAt = new Date().toISOString();
        job.attempts = (job.attempts || 0) + 1;
        this.saveQueue(queue);

        // Decode Base64 to Uint8Array
        let rawBytes: Uint8Array;
        try {
          const binary = atob(job.payload);
          rawBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            rawBytes[i] = binary.charCodeAt(i);
          }
        } catch (e: any) {
          job.status = 'FAILED';
          job.error = `Corrupt print payload: ${e.message}`;
          this.saveQueue(queue);
          continue;
        }

        // Dispatch to hardware through NativeBridgeService
        const targetId = printer.connectionType === 'lan' ? (printer.ipAddress || '') : (printer.deviceIdentifier || '');
        const res = await NativeBridgeService.printer.print(
          printer.connectionType,
          targetId,
          rawBytes,
          printer.port || 9100
        );

        if (res.success) {
          job.status = 'COMPLETED';
          job.completedAt = new Date().toISOString();
          job.error = undefined;
          printer.status = 'connected';
          printer.lastPrintedAt = new Date().toISOString();
          StorageService.savePrinter(printer);
        } else {
          // If failed, check attempt count
          if (job.attempts >= 4) {
            job.status = 'FAILED';
          } else {
            job.status = 'PENDING'; // Leave pending for retry
          }
          job.error = res.error || 'Physical printer unreachable';
          printer.status = 'offline';
          StorageService.savePrinter(printer);
        }

        this.saveQueue(queue);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manual Actions from Print Queue Screen (Section 31)
   */
  static retryJob(jobId: string): void {
    const queue = this.getQueue();
    const job = queue.find(j => j.id === jobId);
    if (job) {
      job.status = 'PENDING';
      job.attempts = 0;
      job.error = undefined;
      this.saveQueue(queue);
      this.processQueue();
    }
  }

  static reassignPrinter(jobId: string, newPrinterId: string): void {
    const queue = this.getQueue();
    const job = queue.find(j => j.id === jobId);
    const printers = StorageService.getPrinters();
    const newPrinter = printers.find(p => p.id === newPrinterId);

    if (job && newPrinter) {
      job.printerId = newPrinter.id;
      job.printerName = newPrinter.name;
      job.status = 'PENDING';
      job.attempts = 0;
      job.error = undefined;
      this.saveQueue(queue);
      this.processQueue();
    }
  }

  static cancelJob(jobId: string): void {
    const queue = this.getQueue();
    const job = queue.find(j => j.id === jobId);
    if (job) {
      job.status = 'CANCELLED';
      this.saveQueue(queue);
    }
  }

  static clearCompleted(): void {
    const queue = this.getQueue().filter(j => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
    this.saveQueue(queue);
  }
}

// Startup Print Queue Worker (Section 23: On application startup, recover pending print jobs)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    PrintQueueService.processQueue();
  }, 1000);
}
