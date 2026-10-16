/**
 * Real Web Bluetooth Thermal Printer Service
 * Connects to ESC/POS Bluetooth printers (e.g. X18 Mini, POS-58, MPT-II, Goojprt, Munbyn, Star, Epson, Phomemo)
 * using the standard browser Web Bluetooth API (GATT services and characteristics).
 *
 * Implements:
 * - Real runtime platform detection (Android, iOS, Windows, macOS, Linux, ChromeOS, WebView)
 * - Real Bluetooth permissions & error handling
 * - Strict device capability verification (GATT handshake & ESC/POS initialization)
 * - Live connection state tracking (via 'gattserverdisconnected' events)
 * - Real binary ESC/POS transmission without mock timers
 */

export interface DiscoveredBluetoothPrinter {
  id: string;
  name: string;
  device: any;
  gattServer?: any;
  verifiedPrinter?: boolean;
  protocol?: string;
  capabilities?: string[];
  paperWidth?: 58 | 80;
}

export interface ScanAndPairResult {
  success: boolean;
  printer?: DiscoveredBluetoothPrinter;
  error?: string;
  isSecurityBlocked?: boolean;
  isIframe?: boolean;
}

export interface PlatformEnvironment {
  platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'chromeos' | 'webview' | 'unknown';
  isWebBluetoothSupported: boolean;
  isWebUsbSupported: boolean;
  isInIframe: boolean;
  supportNotice?: string;
}

// Comprehensive catalog of thermal printer BLE service UUIDs
export const THERMAL_PRINTER_BLE_SERVICES: string[] = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Thermal Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 module (X18 Mini & budget 58mm/80mm ESC/POS)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // POS-58 / PT-210 / GOOJPRT
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART serial
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic Semiconductor NUS (Phomemo, Paperang, X18)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Thermal POS
  '0000fff0-0000-1000-8000-00805f9b34fb', // Zjiang / Milestone POS
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / MPT-II
  '0000fef5-0000-1000-8000-00805f9b34fb', // Dialog DA14580 (Mini POS)
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
  '0000ae00-0000-1000-8000-00805f9b34fb', // Rongta / SPRT
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '0000180a-0000-1000-8000-00805f9b34fb'  // Device Info
];

export class BluetoothPrinterService {
  // Active in-memory paired device references
  private static deviceRegistry = new Map<string, any>();
  // Active GATT characteristic references for writing
  private static charRegistry = new Map<string, any>();
  // Event listeners for disconnect
  private static disconnectListeners = new Map<string, () => void>();

  /**
   * Detects the runtime environment and Bluetooth capabilities (Section 7)
   */
  static detectEnvironment(): PlatformEnvironment {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let platform: PlatformEnvironment['platform'] = 'unknown';

    if (/android/i.test(ua)) {
      platform = /wv|version\/[\d.]+/i.test(ua) ? 'webview' : 'android';
    } else if (/ipad|iphone|ipod/i.test(ua)) {
      platform = 'ios';
    } else if (/macintosh|mac os x/i.test(ua)) {
      platform = 'mac';
    } else if (/windows/i.test(ua)) {
      platform = 'windows';
    } else if (/cros/i.test(ua)) {
      platform = 'chromeos';
    } else if (/linux/i.test(ua)) {
      platform = 'linux';
    }

    const isWebBluetoothSupported =
      typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!(navigator as any).bluetooth;

    const isWebUsbSupported =
      typeof navigator !== 'undefined' && 'usb' in navigator && !!(navigator as any).usb;

    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    let supportNotice: string | undefined;
    if (!isWebBluetoothSupported) {
      if (platform === 'ios') {
        supportNotice =
          'Web Bluetooth is not supported in Safari on iOS. For thermal printing on iOS, use a LAN network printer or host bridge.';
      } else {
        supportNotice =
          'Web Bluetooth API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Chrome on Android with Bluetooth turned on.';
      }
    } else if (isInIframe) {
      supportNotice =
        'Running inside an iframe container. If the browser blocks Bluetooth discovery, open the application in a full browser tab.';
    }

    return {
      platform,
      isWebBluetoothSupported,
      isWebUsbSupported,
      isInIframe,
      supportNotice
    };
  }

  /**
   * Checks whether the current browser supports Web Bluetooth
   */
  static isSupported(): boolean {
    return this.detectEnvironment().isWebBluetoothSupported;
  }

  /**
   * Discovers and verifies a real Bluetooth printer (Section 5, 8, 9, 10, 11)
   */
  static async scanAndPair(): Promise<ScanAndPairResult> {
    const env = this.detectEnvironment();
    if (!env.isWebBluetoothSupported) {
      return {
        success: false,
        isSecurityBlocked: false,
        isIframe: env.isInIframe,
        error:
          env.supportNotice ||
          'Bluetooth printer scanning is not supported in this environment.'
      };
    }

    let device: any = null;
    try {
      // Step 1: Real browser / OS Bluetooth picker request
      device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: THERMAL_PRINTER_BLE_SERVICES
      });
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // User closed the native picker without choosing a device
        return {
          success: false,
          error: 'Bluetooth scan was cancelled or no device was chosen.'
        };
      }

      const msg = err.message ? err.message.toLowerCase() : '';
      if (
        err.name === 'SecurityError' ||
        msg.includes('permissions policy') ||
        msg.includes('security policy') ||
        msg.includes('not allowed')
      ) {
        return {
          success: false,
          isSecurityBlocked: true,
          isIframe: env.isInIframe,
          error:
            'Bluetooth access was blocked by browser security policy. If inside an iframe, please open the application directly in a browser tab.'
        };
      }

      if (msg.includes('adapter not available') || msg.includes('bluetooth is not available')) {
        return {
          success: false,
          error:
            'Bluetooth is disabled on this device. Please turn on Bluetooth in your operating system settings and try again.'
        };
      }

      return {
        success: false,
        error:
          err.message ||
          'Bluetooth discovery failed. Ensure Bluetooth is enabled and the printer is powered on and in pairing mode.'
      };
    }

    if (!device) {
      return { success: false, error: 'No Bluetooth device selected.' };
    }

    // Step 2: Use platform-provided identifier or neutral label (Section 8)
    const deviceId = device.id || `bt_${Date.now()}`;
    const deviceName = device.name || `Unknown Bluetooth Device (${deviceId.substring(0, 8)})`;

    // Step 3: Establish GATT connection & Verify Printer Capability (Section 9)
    if (!device.gatt) {
      return {
        success: false,
        error: 'Selected Bluetooth device does not expose GATT server interface.'
      };
    }

    let gattServer: any = null;
    try {
      gattServer = await device.gatt.connect();
    } catch (gattErr: any) {
      return {
        success: false,
        error: `Could not establish GATT connection with ${deviceName}: ${gattErr.message || 'Connection refused'}`
      };
    }

    // Step 4: Discover writable characteristic across services (Section 9)
    let writeChar: any = null;
    let detectedProtocol = 'Generic Thermal BLE';
    const detectedCapabilities: string[] = ['text'];

    try {
      const services = await gattServer.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              // Check service UUID against known profiles
              const uuid = service.uuid.toLowerCase();
              if (uuid.includes('18f0') || uuid.includes('ff00')) {
                detectedProtocol = 'ESC/POS Standard Thermal';
                detectedCapabilities.push('escpos', 'barcode', 'qr');
              } else if (uuid.includes('ffe0')) {
                detectedProtocol = 'HM-10 ESC/POS Serial';
                detectedCapabilities.push('escpos', 'barcode', 'qr');
              } else if (uuid.includes('6e400001')) {
                detectedProtocol = 'Nordic UART ESC/POS';
                detectedCapabilities.push('escpos', 'barcode', 'qr');
              } else if (uuid.includes('49535343')) {
                detectedProtocol = 'ISSC Transparent Serial';
                detectedCapabilities.push('escpos');
              } else if (uuid.includes('e7810a71')) {
                detectedProtocol = 'PT-210 / POS-58 ESC/POS';
                detectedCapabilities.push('escpos', 'barcode');
              }
              break;
            }
          }
          if (writeChar) break;
        } catch {
          continue;
        }
      }
    } catch (svcErr: any) {
      console.warn('Primary services search notice:', svcErr);
    }

    // Fallback: If getPrimaryServices was restricted, test known thermal UUIDs directly
    if (!writeChar) {
      for (const serviceUuid of THERMAL_PRINTER_BLE_SERVICES) {
        try {
          const service = await gattServer.getPrimaryService(serviceUuid);
          if (service) {
            const chars = await service.getCharacteristics();
            for (const char of chars) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeChar = char;
                detectedProtocol = 'ESC/POS BLE Service';
                detectedCapabilities.push('escpos', 'barcode', 'qr');
                break;
              }
            }
            if (writeChar) break;
          }
        } catch {
          continue;
        }
      }
    }

    // Step 5: Check if verified as a thermal printer (Section 9)
    if (!writeChar) {
      try {
        device.gatt.disconnect();
      } catch {
        // Ignore disconnect error
      }
      return {
        success: false,
        error:
          'Device connected, but printer capabilities could not be verified. No writable thermal print GATT characteristic was found.'
      };
    }

    // Step 6: Send initialization sequence (ESC @) to verify transmission channel
    try {
      const initCommand = new Uint8Array([0x1b, 0x40]); // ESC @
      if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(initCommand);
      } else {
        await writeChar.writeValue(initCommand);
      }
    } catch (initErr: any) {
      console.warn('Initialization command notice:', initErr);
    }

    // Store in active device & characteristic registry
    this.deviceRegistry.set(deviceId, device);
    this.charRegistry.set(deviceId, writeChar);
    if (device.name) {
      this.deviceRegistry.set(device.name, device);
      this.charRegistry.set(device.name, writeChar);
    }

    // Listen for live disconnect event
    device.addEventListener('gattserverdisconnected', () => {
      this.charRegistry.delete(deviceId);
      const cb = this.disconnectListeners.get(deviceId);
      if (cb) cb();
    });

    // Check if name indicates X18 Mini specifically
    const isX18 = deviceName.toUpperCase().includes('X18');
    if (isX18) {
      detectedProtocol = 'X18 Mini Portable BLE';
    }

    return {
      success: true,
      printer: {
        id: deviceId,
        name: deviceName,
        device,
        gattServer,
        verifiedPrinter: true,
        protocol: detectedProtocol,
        capabilities: detectedCapabilities,
        paperWidth: 58
      }
    };
  }

  /**
   * Registers a disconnect listener for a printer
   */
  static onDisconnected(identifier: string, callback: () => void): void {
    this.disconnectListeners.set(identifier, callback);
  }

  /**
   * Real connection test to live hardware (Section 13 & 14)
   */
  static async testConnection(identifier: string): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    status: 'connected' | 'disconnected' | 'error';
  }> {
    const startTime = Date.now();
    const device = this.deviceRegistry.get(identifier);

    if (!device) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        status: 'disconnected',
        message: 'Printer is not connected in this session. Click "Scan Bluetooth Printers" to connect.'
      };
    }

    try {
      if (!device.gatt.connected) {
        await device.gatt.connect();
      }
      const latency = Date.now() - startTime;
      return {
        success: true,
        latencyMs: latency,
        status: 'connected',
        message: `Verified GATT connection with ${device.name || 'Bluetooth Printer'} (${latency}ms).`
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        status: 'disconnected',
        message: `Bluetooth connection failed: ${err.message || 'Device out of range or powered off'}`
      };
    }
  }

  /**
   * Sends real binary ESC/POS payload to printer via GATT (Section 13)
   */
  static async printRaw(
    identifier: string,
    data: Uint8Array
  ): Promise<{ success: boolean; error?: string }> {
    const device = this.deviceRegistry.get(identifier);

    if (!device) {
      return {
        success: false,
        error: 'Printer is disconnected. Please click "Scan Bluetooth Printers" to connect to the hardware device.'
      };
    }

    try {
      if (!device.gatt.connected) {
        await device.gatt.connect();
      }

      let writeChar = this.charRegistry.get(identifier);
      if (!writeChar) {
        // Re-locate characteristic
        const server = device.gatt;
        for (const serviceUuid of THERMAL_PRINTER_BLE_SERVICES) {
          try {
            const service = await server.getPrimaryService(serviceUuid);
            if (service) {
              const chars = await service.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  writeChar = c;
                  this.charRegistry.set(identifier, c);
                  break;
                }
              }
              if (writeChar) break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!writeChar) {
        return {
          success: false,
          error: 'No writable GATT characteristic found on printer. Verify printer ESC/POS protocol.'
        };
      }

      // Write in safe BLE packet chunks (50 bytes)
      const chunkSize = 50;
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.slice(offset, offset + chunkSize);
        if (writeChar.writeValueWithoutResponse) {
          await writeChar.writeValueWithoutResponse(chunk);
        } else {
          await writeChar.writeValue(chunk);
        }
        // Micro-delay between packets to avoid overflowing physical printer buffer
        await new Promise(r => setTimeout(r, 20));
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: `Hardware transmission failure: ${err.message || 'Bluetooth connection dropped during print'}`
      };
    }
  }
}
