import { Printer, PrinterDiagnosticResult } from '../../../types/printer.ts';

export interface PrintPayload {
  jobId: string;
  title: string;
  bytes: Uint8Array;
  previewText: string;
  saleId?: string;
  cutPaper?: boolean;
  kickDrawer?: boolean;
}

export interface AdapterTestResult {
  success: boolean;
  latencyMs?: number;
  message: string;
  error?: string;
}

export interface PrinterAdapter {
  readonly adapterName: string;

  /**
   * Test connection to the target printer
   */
  testConnection(printer: Printer): Promise<AdapterTestResult>;

  /**
   * Transmit raw ESC/POS binary data to printer
   */
  print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }>;

  /**
   * Diagnostic inspection
   */
  diagnose(printer: Printer): Promise<PrinterDiagnosticResult>;
}
