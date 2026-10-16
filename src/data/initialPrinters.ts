import { Printer, PrinterRoute } from '../types/printer.ts';

// Real hardware printers are added by scanning for Bluetooth devices or adding LAN/USB printers.
// No mock/fake pre-configured printers.
export const INITIAL_PRINTERS: Printer[] = [];

export const INITIAL_PRINTER_ROUTES: PrinterRoute[] = [];
