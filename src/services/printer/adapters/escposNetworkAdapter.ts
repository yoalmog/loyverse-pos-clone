import { Printer, PrinterDiagnosticResult } from '../../../types/printer.ts';
import { AdapterTestResult, PrinterAdapter, PrintPayload } from './printerAdapter.ts';
import { EscPosBuilder } from '../escposBuilder.ts';
import { NativeBridgeService } from '../../native/NativeBridgeService.ts';

export class EscPosNetworkAdapter implements PrinterAdapter {
  readonly adapterName = 'EscPosNetworkAdapter';

  /**
   * Validates IP address string
   */
  static isValidIPv4(ip: string): boolean {
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
    });
  }

  async testConnection(printer: Printer): Promise<AdapterTestResult> {
    const startTime = Date.now();
    const ip = printer.ipAddress?.trim();
    const port = printer.port || 9100;

    if (!ip) {
      return {
        success: false,
        message: 'No IP address configured for LAN printer.',
        error: 'NO_IP_SPECIFIED'
      };
    }

    if (!EscPosNetworkAdapter.isValidIPv4(ip)) {
      return {
        success: false,
        message: `Invalid IP address format: "${ip}". Enter a valid local IPv4 address (e.g. 192.168.1.100).`,
        error: 'INVALID_IP_ADDRESS'
      };
    }

    if (port <= 0 || port > 65535) {
      return {
        success: false,
        message: `Invalid TCP port: ${port}. ESC/POS standard network port is 9100.`,
        error: 'INVALID_PORT'
      };
    }

    // 1. Native Android TCP Socket Test
    if (NativeBridgeService.isNativeAndroid()) {
      try {
        const res = await NativeBridgeService.printer.testNetwork(ip, port);
        return {
          success: res.success,
          latencyMs: res.latencyMs || Date.now() - startTime,
          message: res.message || (res.success ? `Connected to ${ip}:${port}` : (res.error || 'Failed to reach printer')),
          error: res.success ? undefined : (res.error || 'NETWORK_ERROR')
        };
      } catch (err: any) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          message: err?.message || 'Network test failed',
          error: 'NETWORK_ERROR'
        };
      }
    }

    // 2. Try live probe via backend TCP bridge if available in dev environment
    try {
      const res = await fetch('/api/printer/lan-probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return {
            success: true,
            latencyMs: data.latencyMs || Date.now() - startTime,
            message: `Confirmed TCP 9100 connection with ${ip}:${port}.`
          };
        } else {
          return {
            success: false,
            latencyMs: Date.now() - startTime,
            message: `Could not connect to ${ip}:${port}: ${data.error || 'Connection refused or host unreachable'}`
          };
        }
      }
    } catch {
      // Backend probe endpoint not available in static preview
    }

    // If live socket endpoint is unreachable from browser sandbox:
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      message: `Direct TCP socket probe on ${ip}:${port} requires the native AuraPOS Android application. Web browser sandbox blocks raw TCP sockets.`
    };
  }

  async print(printer: Printer, payload: PrintPayload): Promise<{ success: boolean; error?: string }> {
    const ip = printer.ipAddress?.trim();
    const port = printer.port || 9100;

    if (!ip) {
      return { success: false, error: 'No IP address specified for network printer.' };
    }

    // 1. Native Android direct raw TCP 9100 transmission
    if (NativeBridgeService.isNativeAndroid()) {
      return await NativeBridgeService.printer.print('lan', ip, payload.bytes, port);
    }

    // 2. Browser fallback via server-side TCP proxy
    let binary = '';
    const len = payload.bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(payload.bytes[i]);
    }
    const base64Data = typeof btoa !== 'undefined' ? btoa(binary) : '';

    try {
      const res = await fetch('/api/printer/lan-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port, base64Data })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true };
        } else {
          return { success: false, error: data.error || `Failed to transmit print job to ${ip}:${port}` };
        }
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Could not reach ${ip}:${port}: ${err.message || 'Direct TCP socket requires native AuraPOS Android runtime'}`
      };
    }

    return {
      success: false,
      error: `Network print transport to ${ip}:${port} unavailable. Direct TCP port 9100 requires native AuraPOS Android terminal.`
    };
  }

  async diagnose(printer: Printer): Promise<PrinterDiagnosticResult> {
    const test = await this.testConnection(printer);
    const isNative = NativeBridgeService.isNativeAndroid();

    return {
      printerId: printer.id,
      printerName: printer.name,
      reachable: test.success,
      latencyMs: test.latencyMs,
      protocol: isNative ? `Native Android TCP Socket on port ${printer.port || 9100}` : `TCP 9100 / ESC/POS (${printer.ipAddress || 'No IP'}:${printer.port || 9100})`,
      paperWidth: printer.paperWidth || 80,
      encoding: printer.encoding || 'auto',
      details: test.message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generates a standard ESC/POS test print payload
   */
  static generateTestReceipt(printer: Printer): { builder: EscPosBuilder; previewText: string } {
    const builder = new EscPosBuilder(printer.charactersPerLine || 48);

    builder
      .initialize()
      .doubleSeparator()
      .setAlignment('center')
      .setFontSize('double_height')
      .setBold(true)
      .line('POS PRINTER TEST')
      .setFontSize('normal')
      .setBold(false)
      .line()
      .setAlignment('left')
      .line(`Printer:  ${printer.name}`)
      .line(`Model:    ${printer.model}`)
      .line(`IP Addr:  ${printer.ipAddress || 'Not set'}`)
      .line(`Port:     ${printer.port || 9100}`)
      .line(`Protocol: ESC/POS TCP 9100`)
      .line(`Paper:    ${printer.paperWidth}mm (${printer.charactersPerLine} cols)`)
      .line(`Time:     ${new Date().toLocaleString()}`)
      .line()
      .setAlignment('center')
      .setBold(true)
      .line('Hardware verification test.')
      .setBold(false)
      .doubleSeparator()
      .feed(2);

    if (printer.supportsBarcode) {
      builder.barcode('TEST-PRN-9100', 'CODE128');
    }

    if (printer.supportsCut) {
      builder.cut(false);
    }

    return {
      builder,
      previewText: builder.toPreviewText()
    };
  }
}
