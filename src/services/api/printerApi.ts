/**
 * REST API Client for Printers conforming to Section 23 specifications
 */

import { Printer, PrinterRoute, PrintJob } from '../../types/printer.ts';
import { PrintService } from '../printer/printService.ts';

export class PrinterApiClient {
  // GET /api/v1/printers
  static async getPrinters(): Promise<Printer[]> {
    return PrintService.getPrinters();
  }

  // POST /api/v1/printers
  static async createPrinter(data: Omit<Printer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Printer> {
    const newPrinter: Printer = {
      ...data,
      id: `prn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return PrintService.savePrinter(newPrinter);
  }

  // GET /api/v1/printers/:id
  static async getPrinter(id: string): Promise<Printer | undefined> {
    return PrintService.getPrinterById(id);
  }

  // PUT /api/v1/printers/:id
  static async updatePrinter(id: string, updates: Partial<Printer>): Promise<Printer | undefined> {
    const existing = PrintService.getPrinterById(id);
    if (!existing) return undefined;
    const updated: Printer = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    return PrintService.savePrinter(updated);
  }

  // DELETE /api/v1/printers/:id
  static async deletePrinter(id: string): Promise<boolean> {
    PrintService.deletePrinter(id);
    return true;
  }

  // POST /api/v1/printers/:id/test
  static async testConnection(id: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    return PrintService.testConnection(id);
  }

  // POST /api/v1/printers/:id/status
  static async getStatus(id: string): Promise<{ status: string; reachable: boolean; details?: string }> {
    const diag = await PrintService.getDiagnostics(id);
    return {
      status: diag?.reachable ? 'online' : 'offline',
      reachable: diag?.reachable || false,
      details: diag?.details
    };
  }

  // POST /api/v1/printers/:id/print
  static async testPrint(id: string): Promise<{ success: boolean; message: string }> {
    return PrintService.testPrint(id);
  }

  // GET /api/v1/printer-routes
  static async getRoutes(): Promise<PrinterRoute[]> {
    return PrintService.getRoutes();
  }

  // POST /api/v1/printer-routes
  static async createRoute(route: Omit<PrinterRoute, 'id' | 'createdAt' | 'updatedAt'>): Promise<PrinterRoute> {
    const newRoute: PrinterRoute = {
      ...route,
      id: `route_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return PrintService.saveRoute(newRoute);
  }

  // PUT /api/v1/printer-routes/:id
  static async updateRoute(id: string, updates: Partial<PrinterRoute>): Promise<PrinterRoute | undefined> {
    const routes = PrintService.getRoutes();
    const existing = routes.find(r => r.id === id);
    if (!existing) return undefined;
    const updated: PrinterRoute = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    return PrintService.saveRoute(updated);
  }

  // DELETE /api/v1/printer-routes/:id
  static async deleteRoute(id: string): Promise<boolean> {
    PrintService.deleteRoute(id);
    return true;
  }

  // GET /api/v1/print-jobs
  static async getJobs(): Promise<PrintJob[]> {
    return PrintService.getPrintJobs();
  }

  // POST /api/v1/print-jobs/:id/retry
  static async retryJob(id: string): Promise<boolean> {
    return PrintService.retryJob(id);
  }
}
