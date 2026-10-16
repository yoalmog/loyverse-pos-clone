import { Printer, PrinterDiagnosticResult } from '../../../types/printer.ts';
import { AdapterTestResult, PrinterAdapter, PrintPayload } from './printerAdapter.ts';
import { NativeBridgeService } from '../../native/NativeBridgeService.ts';

export class BrowserPrintAdapter implements PrinterAdapter {
  readonly adapterName = 'BrowserPrintAdapter';

  async testConnection(printer: Printer): Promise<AdapterTestResult> {
    if (NativeBridgeService.isNativeAndroid()) {
      return {
        success: true,
        latencyMs: 5,
        message: 'Native Android PrintManager service available.'
      };
    }
    return {
      success: true,
      latencyMs: 5,
      message: 'System print spooler available via host OS print engine.'
    };
  }

  async print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }> {
    // 1. On Native Android POS, dispatch directly to Android System PrintManager!
    if (NativeBridgeService.isNativeAndroid()) {
      return await NativeBridgeService.printer.printSystemSpooler(payload.title, payload.previewText);
    }

    // 2. Web browser fallback: open system print dialog
    try {
      if (typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${payload.title}</title>
                <style>
                  @page { margin: 4mm; }
                  body {
                    font-family: monospace;
                    font-size: 11px;
                    white-space: pre-wrap;
                    padding: 8px;
                    margin: 0;
                  }
                </style>
              </head>
              <body>${payload.previewText}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          setTimeout(() => {
            try { printWindow.close(); } catch (_) {}
          }, 2000);
          return { success: true };
        } else {
          // If popup blocked, use iframe
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.bottom = '0';
          iframe.style.right = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          document.body.appendChild(iframe);

          const doc = iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${payload.title}</title>
                  <style>
                    body {
                      font-family: monospace;
                      font-size: 11px;
                      white-space: pre-wrap;
                      padding: 8px;
                      margin: 0;
                    }
                  </style>
                </head>
                <body>${payload.previewText}</body>
              </html>
            `);
            doc.close();
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          }

          setTimeout(() => {
            try {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            } catch (_) {}
          }, 3000);
          return { success: true };
        }
      }
      return { success: false, error: 'Document window unavailable for browser print.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Browser print failed' };
    }
  }

  async diagnose(printer: Printer): Promise<PrinterDiagnosticResult> {
    const isNative = NativeBridgeService.isNativeAndroid();
    return {
      printerId: printer.id,
      printerName: printer.name,
      reachable: true,
      latencyMs: 5,
      protocol: isNative ? 'Android Native PrintManager' : 'Host OS Print Spooler (System Dialog)',
      paperWidth: printer.paperWidth || 80,
      encoding: 'UTF-8',
      details: isNative
        ? 'Active. Dispatches print job to Android system spooler dialog.'
        : 'Ready. Generates print job dispatched to host system spooler.',
      timestamp: new Date().toISOString()
    };
  }
}
