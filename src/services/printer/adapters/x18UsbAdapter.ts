import { Printer, PrinterDiagnosticResult } from '../../../types/printer.ts';
import { AdapterTestResult, PrinterAdapter, PrintPayload } from './printerAdapter.ts';
import { NativeBridgeService } from '../../native/NativeBridgeService.ts';

export class X18USBAdapter implements PrinterAdapter {
  readonly adapterName = 'X18USBAdapter';

  private static activeUsbDevices = new Map<string, any>();

  /**
   * Discovers a real USB printer via WebUSB API (Browser) or Native Android USB Host
   */
  static async requestUsbPrinter(): Promise<{ success: boolean; printer?: any; error?: string }> {
    if (NativeBridgeService.isNativeAndroid()) {
      const devices = NativeBridgeService.printer.scanUSB();
      if (devices.length === 0) {
        return {
          success: false,
          error: 'No USB thermal printer detected. Please connect your printer via USB OTG cable.'
        };
      }
      const device = devices[0];
      const connectRes = await NativeBridgeService.printer.connectUSB(device.id);
      if (connectRes.success) {
        return {
          success: true,
          printer: {
            id: device.id,
            name: device.name || 'Native USB Thermal Printer',
            vendorId: device.vendorId,
            productId: device.productId
          }
        };
      } else {
        return {
          success: false,
          error: connectRes.error || 'Failed to claim USB printer.'
        };
      }
    }

    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return {
        success: false,
        error: 'WebUSB API is not supported in this browser environment. Use the native AuraPOS Android application.'
      };
    }

    try {
      // Request device with printer interface class (Class 7 = Printer)
      const device = await (navigator as any).usb.requestDevice({
        filters: [{ classCode: 7 }, { vendorId: 0x0416 }, { vendorId: 0x0483 }]
      });

      if (!device) {
        return { success: false, error: 'No USB printer selected.' };
      }

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);

      const deviceId = `usb_${device.vendorId}_${device.productId}_${Date.now()}`;
      const name = device.productName || `USB Thermal Printer (${device.vendorId.toString(16)}:${device.productId.toString(16)})`;

      this.activeUsbDevices.set(deviceId, device);

      return {
        success: true,
        printer: {
          id: deviceId,
          name,
          vendorId: device.vendorId,
          productId: device.productId
        }
      };
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        return { success: false, error: 'USB printer selection was cancelled.' };
      }
      if (err.name === 'SecurityError') {
        return { success: false, error: 'USB access denied by browser security policy.' };
      }
      return { success: false, error: err.message || 'Failed to connect to USB printer.' };
    }
  }

  async testConnection(printer: Printer): Promise<AdapterTestResult> {
    const startTime = Date.now();
    const identifier = printer.deviceIdentifier || printer.id;

    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.printer.connectUSB(identifier);
        return {
          success: res.success,
          latencyMs: Date.now() - startTime,
          message: res.success ? `USB printer ${res.name || printer.name} claimed and ready.` : (res.error || 'USB connection failed'),
          error: res.success ? undefined : 'USB_NOT_CONNECTED'
        };
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          message: err?.message || 'USB error',
          error: 'USB_ERROR'
        };
      }
    }

    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: 'WebUSB is not supported in this browser. Use the native AuraPOS Android application.',
        error: 'WEBUSB_UNSUPPORTED'
      };
    }

    const device = X18USBAdapter.activeUsbDevices.get(identifier);
    if (!device || !device.opened) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: 'USB printer is disconnected. Connect USB cable and authorize printer.',
        error: 'USB_DETACHED'
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime,
      message: `USB printer (${device.productName || printer.name}) connected and ready.`
    };
  }

  async print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }> {
    const identifier = printer.deviceIdentifier || printer.id;

    if (NativeBridgeService.isNativeAndroid()) {
      return await NativeBridgeService.printer.print('usb', identifier, payload.bytes);
    }

    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return { success: false, error: 'WebUSB API unavailable in this browser.' };
    }

    const device = X18USBAdapter.activeUsbDevices.get(identifier);
    if (!device || !device.opened) {
      return { success: false, error: 'USB printer is disconnected or uninitialized.' };
    }

    try {
      const endpoint = device.configuration?.interfaces[0]?.alternate?.endpoints?.find(
        (e: any) => e.direction === 'out'
      );
      const endpointNumber = endpoint?.endpointNumber || 1;

      await device.transferOut(endpointNumber, payload.bytes);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `USB write error: ${err.message || 'Bulk transfer failed'}` };
    }
  }

  async diagnose(printer: Printer): Promise<PrinterDiagnosticResult> {
    const test = await this.testConnection(printer);
    const isNative = NativeBridgeService.isNativeAndroid();

    return {
      printerId: printer.id,
      printerName: printer.name,
      reachable: test.success,
      latencyMs: test.latencyMs,
      protocol: isNative ? 'Native Android USB Host Bulk Endpoint' : 'WebUSB Bulk Endpoint',
      paperWidth: printer.paperWidth || 58,
      encoding: printer.encoding || 'CP437',
      details: test.message,
      timestamp: new Date().toISOString()
    };
  }
}
