/**
 * Dual Printer System - Domain Types & Specifications
 * Production hardware printers: Real Bluetooth BLE, USB, LAN TCP 9100, and System print
 */

export type PrinterType = 'x18' | 'x6' | 'cat' | 'escpos' | 'browser' | 'usb' | 'builtin' | 'sunmi';

export type ConnectionType = 'bluetooth' | 'usb' | 'lan' | 'browser' | 'builtin';

export type PrinterProtocolType = 'X6H_BLE' | 'ESC_POS' | 'SUNMI' | 'AUTO';

export type PrinterPurpose = 'receipt' | 'kitchen' | 'bar' | 'label' | 'report' | 'all';

export type PrinterStatus =
  | 'available'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'printing'
  | 'error'
  | 'permission_required'
  | 'unsupported'
  | 'unknown'
  | 'ready'
  | 'online'
  | 'offline';

export type PaperWidthMm = 58 | 80 | 76;

export type PrinterEncoding =
  | 'auto'
  | 'UTF-8'
  | 'CP437'
  | 'CP850'
  | 'CP858'
  | 'Windows-1252';

export interface Printer {
  id: string;
  storeId: string;
  name: string;
  model: string;
  printerType: PrinterType;
  connectionType: ConnectionType;
  protocol?: PrinterProtocolType;
  ipAddress?: string; // For LAN printers (e.g. 192.168.1.100)
  port?: number; // Default 9100
  deviceIdentifier?: string; // Bluetooth UUID/MAC or USB Vendor/Product ID
  paperWidth: PaperWidthMm; // 58, 80, 76
  charactersPerLine: number; // e.g. 32 for 58mm, 48 for 80mm
  encoding: PrinterEncoding;
  isDefault: boolean;
  printerPurpose: PrinterPurpose;
  autoPrint: boolean;
  supportsCut: boolean;
  supportsCashDrawer: boolean;
  supportsQr: boolean;
  supportsBarcode: boolean;
  status: PrinterStatus;
  capabilities?: string[]; // e.g. ['escpos', 'text', 'barcode', 'qr']
  lastCheckedAt?: string;
  lastPrintedAt?: string;
  lastSeenAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterRoute {
  id: string;
  storeId: string;
  printerId: string;
  categoryId?: string; // Category-level routing
  productId?: string; // Product-level routing (highest priority)
  purpose: PrinterPurpose;
  priority: number; // higher = higher precedence
  autoPrint: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PrintJobType = 'receipt' | 'kitchen' | 'bar' | 'label' | 'report' | 'test';

export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  storeId: string;
  printerId: string;
  printerName?: string;
  saleId?: string;
  jobType: PrintJobType;
  title: string;
  content: string; // human-readable preview text
  rawCommands?: string; // base64 or debug representation
  status: PrintJobStatus;
  attemptCount: number;
  maxAttempts: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PrinterDiagnosticResult {
  printerId: string;
  printerName: string;
  reachable: boolean;
  latencyMs?: number;
  protocol: string;
  paperWidth: number;
  encoding: string;
  details: string;
  timestamp: string;
}
