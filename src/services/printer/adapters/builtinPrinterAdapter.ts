import { Printer, PrinterDiagnosticResult } from '../../../types/printer.ts';
import { AdapterTestResult, PrinterAdapter, PrintPayload } from './printerAdapter.ts';
import { NativeBridgeService } from '../../native/NativeBridgeService.ts';

/**
 * BuiltinPrinterAdapter - Hardware adapter for integrated POS terminal thermal printers
 * (e.g. Sunmi V1/V2, Pax, iMin, handheld POS with built-in 58mm/80mm thermal head)
 */
export class BuiltinPrinterAdapter implements PrinterAdapter {
  readonly adapterName = 'BuiltinPrinterAdapter';

  async testConnection(printer: Printer): Promise<AdapterTestResult> {
    if (!NativeBridgeService.isNativeAndroid()) {
      return {
        success: false,
        message: 'Built-in POS terminal printer is only available when running on native Android POS hardware.',
        error: 'HARDWARE_UNAVAILABLE'
      };
    }

    const info = NativeBridgeService.printer.getBuiltInPrinter();
    if (info) {
      return {
        success: true,
        latencyMs: 1,
        message: `Connected to ${info.name || 'Integrated Terminal Thermal Printer'}.`
      };
    }

    return {
      success: false,
      message: 'No integrated built-in thermal printer detected on this Android device.',
      error: 'BUILTIN_NOT_FOUND'
    };
  }

  async print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }> {
    if (!NativeBridgeService.isNativeAndroid()) {
      return {
        success: false,
        error: 'Built-in thermal printing requires running the AuraPOS APK on an Android POS terminal.'
      };
    }

    return await NativeBridgeService.printer.print('builtin', 'prn_builtin_internal', payload.bytes);
  }

  async diagnose(printer: Printer): Promise<PrinterDiagnosticResult> {
    const isNative = NativeBridgeService.isNativeAndroid();
    const info = isNative ? NativeBridgeService.printer.getBuiltInPrinter() : null;

    return {
      printerId: printer.id,
      printerName: printer.name,
      reachable: !!info,
      latencyMs: 1,
      protocol: 'Integrated Thermal Head (Sunmi AIDL / Internal Serial)',
      paperWidth: printer.paperWidth || 58,
      encoding: 'CP437',
      details: info ? `Active hardware driver: ${info.name}` : 'Built-in thermal head driver inactive or not present.',
      timestamp: new Date().toISOString()
    };
  }
}
