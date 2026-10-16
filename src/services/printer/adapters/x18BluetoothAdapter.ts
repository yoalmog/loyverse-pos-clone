import { Printer, PrinterDiagnosticResult } from '../../../types/printer.ts';
import { AdapterTestResult, PrinterAdapter, PrintPayload } from './printerAdapter.ts';
import { BluetoothPrinterService } from '../bluetoothPrinterService.ts';
import { NativeBridgeService } from '../../native/NativeBridgeService.ts';

export class X18BluetoothAdapter implements PrinterAdapter {
  readonly adapterName = 'X18BluetoothAdapter';

  async testConnection(printer: Printer): Promise<AdapterTestResult> {
    const identifier = printer.deviceIdentifier || printer.id;
    const isX6 = (printer.name || '').toLowerCase().includes('x6') ||
                 (printer.model || '').toLowerCase().includes('x6') ||
                 (printer.model || '').toLowerCase().includes('cat') ||
                 printer.protocol === 'X6H_BLE';

    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.printer.connectBluetooth(identifier);
        const protocolDesc = isX6 ? 'X6h BLE GATT (0000AE30)' : 'Native RFCOMM SPP';
        return {
          success: res.success,
          message: res.success ? `Connected to ${res.name || printer.name} via ${protocolDesc}.` : (res.error || 'Connection failed'),
          error: res.success ? undefined : 'BT_NOT_CONNECTED'
        };
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Bluetooth connection error',
          error: 'BT_ERROR'
        };
      }
    }

    const res = await BluetoothPrinterService.testConnection(identifier);
    return {
      success: res.success,
      latencyMs: res.latencyMs,
      message: res.message,
      error: res.success ? undefined : 'BLE_NOT_CONNECTED'
    };
  }

  async print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }> {
    const identifier = printer.deviceIdentifier || printer.id;
    const isX6 = (printer.name || '').toLowerCase().includes('x6') ||
                 (printer.model || '').toLowerCase().includes('x6') ||
                 (printer.model || '').toLowerCase().includes('cat') ||
                 printer.protocol === 'X6H_BLE';

    if (NativeBridgeService.isNativeAndroid()) {
      const connType = isX6 ? 'x6h_ble' : 'bluetooth';
      return await NativeBridgeService.printer.print(connType, identifier, payload.bytes);
    }

    return await BluetoothPrinterService.printRaw(identifier, payload.bytes);
  }

  async diagnose(printer: Printer): Promise<PrinterDiagnosticResult> {
    const test = await this.testConnection(printer);
    const isNative = NativeBridgeService.isNativeAndroid();
    const isX6 = (printer.name || '').toLowerCase().includes('x6') ||
                 (printer.model || '').toLowerCase().includes('x6') ||
                 (printer.model || '').toLowerCase().includes('cat') ||
                 printer.protocol === 'X6H_BLE';

    const protocolStr = isNative
      ? (isX6 ? 'Android BLE GATT (X6h 0x5178 Protocol)' : 'Android RFCOMM SPP (ESC/POS)')
      : 'Web Bluetooth BLE GATT';

    return {
      printerId: printer.id,
      printerName: printer.name,
      reachable: test.success,
      latencyMs: test.latencyMs,
      protocol: protocolStr,
      paperWidth: printer.paperWidth || 58,
      encoding: isX6 ? 'X6H Raster LSB-First' : (printer.encoding || 'CP437'),
      details: test.message,
      timestamp: new Date().toISOString()
    };
  }
}
