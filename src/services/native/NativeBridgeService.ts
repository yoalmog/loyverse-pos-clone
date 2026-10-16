/**
 * AuraPOS Centralized Native Android Hardware Bridge Service
 * Conforming to Section 4:
 * The frontend communicates with hardware ONLY through this bridge.
 * Exposes:
 * - printer.scanBluetooth()
 * - printer.connectBluetooth(deviceId)
 * - printer.disconnectBluetooth(deviceId)
 * - printer.print(printerId, data)
 * - printer.testPrint(printerId)
 * - printer.scanUSB()
 * - printer.connectUSB(deviceId)
 * - printer.disconnectUSB(deviceId)
 * - printer.connectNetwork(ip, port)
 * - printer.testNetwork(ip, port)
 * - barcode.startScanner()
 * - barcode.stopScanner()
 * - cashDrawer.open(printerId)
 * - diagnostics.getDiagnostics()
 *
 * Section 36 & 44:
 * Clearly separates Native Android Production from Browser Preview.
 * In browser preview, reports that native hardware is unavailable.
 * Never fakes hardware operations.
 */

// Declare the Android interface injected by MainActivity
declare global {
  interface Window {
    AndroidPOSNative?: {
      scanBluetooth: () => string;
      stopBluetoothScan: () => void;
      getPairedBluetoothDevices: () => string;
      connectBluetooth: (macAddress: string, callbackId: string) => void;
      disconnectBluetooth: (macAddress: string) => void;
      requestBluetoothPermissions?: () => void;
      getBluetoothStatus?: () => string;
      testX6hHardware?: (targetIdentifier: string, callbackId: string) => void;
      testBleWrite?: (targetIdentifier: string, callbackId: string) => void;
      getGattDiagnostic?: (targetIdentifier: string, callbackId: string) => void;

      scanUSB: () => string;
      connectUSB: (deviceName: string, callbackId: string) => void;
      disconnectUSB: (deviceName: string) => void;

      testNetwork: (ip: string, port: number, callbackId: string) => void;

      print: (
        connectionType: string,
        targetIdentifier: string,
        base64Data: string,
        port: number,
        callbackId: string
      ) => void;

      openCashDrawer: (
        printerType: string,
        targetIdentifier: string,
        port: number,
        callbackId: string
      ) => void;

      getBuiltInPrinter?: () => string;
      printViaSystemSpooler?: (title: string, receiptText: string, callbackId: string) => void;

      startBarcodeScanner: () => void;
      stopBarcodeScanner: () => void;

      getDiagnostics: () => string;
      checkBackendHealth?: (targetUrl: string, callbackId: string) => void;
      analyzeMenu?: (payloadJson: string, callbackId: string) => void;

      // Local-First On-Device Menu Scanner (Requirements 1-9, 15)
      launchNativeCamera?: (callbackId: string) => void;
      launchNativeGallery?: (allowMultiple: boolean, callbackId: string) => void;
      importPdfMenu?: (base64Pdf: string, callbackId: string) => void;
      preprocessImageLocal?: (base64Image: string, rotationDegrees: number, callbackId: string) => void;
      recognizeMenuLocal?: (base64Image: string, pageNumber: number, callbackId: string) => void;
      batchImportToDatabase?: (payloadJson: string, callbackId: string) => void;

      vibrate?: (durationMs: number) => void;
      announceForAccessibility?: (text: string) => void;

      // Android Local Database & Sync Engine (Phase 3)
      localDbGetTerminalIdentity?: () => string;
      localDbGetProducts?: (query: string, callbackId: string) => void;
      localDbGetProductByBarcode?: (barcode: string, callbackId: string) => void;
      localDbGetCategories?: (callbackId: string) => void;
      localDbGetCustomers?: (query: string, callbackId: string) => void;
      localDbSaveCustomer?: (customerJson: string, callbackId: string) => void;
      localDbRecordSale?: (saleJson: string, callbackId: string) => void;
      localDbGetSales?: (limit: number, offset: number, callbackId: string) => void;
      localDbGetPendingSyncCount?: (callbackId: string) => void;
      localDbGetSyncStatus?: (callbackId: string) => void;
      localDbTriggerSync?: (callbackId: string) => void;
      localDbRetrySync?: (callbackId: string) => void;
      localDbGetSyncEvents?: (status: string, limit: number, callbackId: string) => void;
      localDbGetLocalReports?: (dateFrom: string, dateTo: string, callbackId: string) => void;
    };
    __AuraPOSNativeCallbacks?: Record<string, (result: any) => void>;
    __AuraPOSEventBus?: {
      emit: (event: string, payload: any) => void;
      listeners: Record<string, Array<(payload: any) => void>>;
      on: (event: string, fn: (payload: any) => void) => () => void;
    };
  }
}

// Initialize Global Event Bus for Native Callbacks and Hardware Events
if (typeof window !== 'undefined') {
  window.__AuraPOSNativeCallbacks = window.__AuraPOSNativeCallbacks || {};
  if (!window.__AuraPOSEventBus) {
    const listeners: Record<string, Array<(payload: any) => void>> = {};
    window.__AuraPOSEventBus = {
      listeners,
      emit: (event, payload) => {
        const fns = listeners[event] || [];
        fns.forEach(fn => {
          try {
            fn(payload);
          } catch (e) {
            console.error(`Error in event listener for ${event}:`, e);
          }
        });
      },
      on: (event, fn) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
        return () => {
          listeners[event] = (listeners[event] || []).filter(item => item !== fn);
        };
      }
    };
  }
}

export interface DiscoveredNativeDevice {
  id: string;
  name: string;
  address?: string;
  bonded?: boolean;
  type: 'bluetooth' | 'usb';
  vendorId?: number;
  productId?: number;
  hasPermission?: boolean;
}

export interface HardwareDiagnosticsResult {
  isNativeAndroid: boolean;
  androidVersion?: string;
  sdkInt?: number;
  deviceModel?: string;
  bluetoothAvailable?: boolean;
  networkAvailable?: boolean;
  appVersion?: string;
  statusMessage?: string;
}

export interface BackendHealthCheckResult {
  success: boolean;
  status: number;
  latencyMs: number;
  dnsOk?: boolean;
  tlsOk?: boolean;
  aiServiceAvailable?: boolean;
  service?: string;
  error?: string;
  errorType?: string;
  timestamp: string;
}

export class NativeBridgeService {
  /**
   * Check if running within the dedicated Native Android POS runtime
   */
  static isNativeAndroid(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.AndroidPOSNative &&
      typeof window.AndroidPOSNative.print === 'function'
    );
  }

  private static callNativeAsync<T>(executor: (callbackId: string) => void, timeoutMs: number = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isNativeAndroid()) {
        reject(
          new Error(
            'Native Android hardware is unavailable in browser preview. Install and run the AuraPOS APK on an Android POS device or terminal.'
          )
        );
        return;
      }

      const callbackId = `cb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timeout = setTimeout(() => {
        delete window.__AuraPOSNativeCallbacks?.[callbackId];
        reject(new Error(`Native hardware bridge response timed out after ${timeoutMs / 1000}s.`));
      }, timeoutMs);

      window.__AuraPOSNativeCallbacks![callbackId] = (result: any) => {
        clearTimeout(timeout);
        delete window.__AuraPOSNativeCallbacks?.[callbackId];
        resolve(result as T);
      };

      try {
        executor(callbackId);
      } catch (e) {
        clearTimeout(timeout);
        delete window.__AuraPOSNativeCallbacks?.[callbackId];
        reject(e);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Centralized Printer Hardware Bridge
  // --------------------------------------------------------------------------
  static printer = {
    /**
     * Start physical Bluetooth scanning (Section 5)
     */
    scanBluetooth: (onDevicesUpdate?: (devices: DiscoveredNativeDevice[]) => void): { success: boolean; error?: string; isNative: boolean } => {
      if (!NativeBridgeService.isNativeAndroid()) {
        return {
          success: false,
          isNative: false,
          error: 'Native Android hardware is unavailable in browser preview. Run the APK on an Android POS device to discover real Bluetooth printers.'
        };
      }

      if (onDevicesUpdate && window.__AuraPOSEventBus) {
        window.__AuraPOSEventBus.on('onBluetoothDevicesDiscovered', (rawJson: string) => {
          try {
            const list = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            onDevicesUpdate(list);
          } catch (e) {
            console.error('Failed to parse discovered Bluetooth devices:', e);
          }
        });
      }

      try {
        const resStr = window.AndroidPOSNative!.scanBluetooth();
        const res = JSON.parse(resStr);
        return { success: res.success, error: res.error, isNative: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Bluetooth scan error', isNative: true };
      }
    },

    stopBluetoothScan: (): void => {
      if (NativeBridgeService.isNativeAndroid()) {
        window.AndroidPOSNative!.stopBluetoothScan();
      }
    },

    getPairedBluetoothDevices: (): DiscoveredNativeDevice[] => {
      if (!NativeBridgeService.isNativeAndroid()) return [];
      try {
        const raw = window.AndroidPOSNative!.getPairedBluetoothDevices();
        return JSON.parse(raw);
      } catch {
        return [];
      }
    },

    getBluetoothStatus: (): { enabled: boolean; hasPermissions: boolean; isNative: boolean } => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.getBluetoothStatus) {
        return { enabled: true, hasPermissions: true, isNative: false };
      }
      try {
        const raw = window.AndroidPOSNative.getBluetoothStatus();
        const parsed = JSON.parse(raw);
        return { enabled: !!parsed.enabled, hasPermissions: !!parsed.hasPermissions, isNative: true };
      } catch {
        return { enabled: true, hasPermissions: true, isNative: true };
      }
    },

    requestBluetoothPermissions: (): void => {
      if (NativeBridgeService.isNativeAndroid() && window.AndroidPOSNative?.requestBluetoothPermissions) {
        window.AndroidPOSNative.requestBluetoothPermissions();
      }
    },

    connectBluetooth: async (deviceId: string): Promise<{ success: boolean; status?: string; name?: string; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.connectBluetooth(deviceId, callbackId);
      });
    },

    disconnectBluetooth: (deviceId: string): void => {
      if (NativeBridgeService.isNativeAndroid()) {
        window.AndroidPOSNative!.disconnectBluetooth(deviceId);
      }
    },

    /**
     * Scan physical USB thermal printers (Section 8)
     */
    scanUSB: (): DiscoveredNativeDevice[] => {
      if (!NativeBridgeService.isNativeAndroid()) return [];
      try {
        const raw = window.AndroidPOSNative!.scanUSB();
        return JSON.parse(raw);
      } catch {
        return [];
      }
    },

    connectUSB: async (deviceId: string): Promise<{ success: boolean; status?: string; name?: string; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.connectUSB(deviceId, callbackId);
      });
    },

    disconnectUSB: (deviceId: string): void => {
      if (NativeBridgeService.isNativeAndroid()) {
        window.AndroidPOSNative!.disconnectUSB(deviceId);
      }
    },

    /**
     * LAN / Wi-Fi thermal printer socket test (Section 7)
     */
    connectNetwork: async (ip: string, port: number = 9100): Promise<{ success: boolean; status?: string; latencyMs?: number; message?: string; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.testNetwork(ip, port, callbackId);
      });
    },

    testNetwork: async (ip: string, port: number = 9100): Promise<{ success: boolean; status?: string; latencyMs?: number; message?: string; error?: string }> => {
      return NativeBridgeService.printer.connectNetwork(ip, port);
    },

    /**
     * Dispatch raw ESC/POS binary stream to physical printer (Section 9 & 10)
     */
    print: async (
      connectionType: 'bluetooth' | 'lan' | 'usb' | string,
      targetIdentifier: string,
      rawBytes: Uint8Array,
      port: number = 9100
    ): Promise<{ success: boolean; bytesPrinted?: number; error?: string }> => {
      if (!NativeBridgeService.isNativeAndroid()) {
        return {
          success: false,
          error: 'Native Android hardware is unavailable in browser preview. Install and run the AuraPOS APK on an Android POS terminal.'
        };
      }

      // Encode raw binary ESC/POS bytes to standard Base64
      let binaryString = '';
      for (let i = 0; i < rawBytes.length; i++) {
        binaryString += String.fromCharCode(rawBytes[i]);
      }
      const base64Data = btoa(binaryString);

      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.print(connectionType, targetIdentifier, base64Data, port, callbackId);
      });
    },

    testPrint: async (printer: {
      connectionType: string;
      deviceIdentifier?: string;
      ipAddress?: string;
      port?: number;
      name?: string;
      model?: string;
      protocol?: string;
      paperWidth?: number;
    }): Promise<{ success: boolean; message?: string; error?: string }> => {
      const targetId = printer.connectionType === 'lan' ? (printer.ipAddress || '') : (printer.deviceIdentifier || '');
      if (!targetId) {
        return { success: false, error: 'Printer identifier or IP address is missing.' };
      }

      if (!NativeBridgeService.isNativeAndroid()) {
        return {
          success: false,
          error: 'Native Android hardware is unavailable in browser preview. Install and run the AuraPOS APK on an Android POS terminal.'
        };
      }

      const pName = (printer.name || '').toLowerCase();
      const pModel = (printer.model || '').toLowerCase();
      const pProto = (printer.protocol || '').toLowerCase();
      const isX6h = pName.includes('x6') || pName.includes('cat') || pModel.includes('x6') || pModel.includes('cat') || pProto.includes('x6') || pProto.includes('cat');

      if (isX6h && window.AndroidPOSNative?.testX6hHardware) {
        try {
          const res = await NativeBridgeService.callNativeAsync<any>(callbackId => {
            window.AndroidPOSNative!.testX6hHardware!(targetId, callbackId);
          });
          if (res.success) {
            return { success: true, message: `X6h BLE test receipt printed successfully on ${printer.name || 'X6h-0000'}.` };
          }
          return { success: false, error: res.error || 'X6h BLE test print failed.' };
        } catch (e: any) {
          return { success: false, error: e?.message || 'X6h BLE test print error.' };
        }
      }

      // Standard ESC/POS test pattern with universal CRLF line endings
      const testBytes = new Uint8Array([
        0x1B, 0x40, // ESC @ (Init)
        0x1B, 0x61, 0x01, // Center align
        ...Array.from('*** AURAPOS HARDWARE TEST ***\r\n').map(c => c.charCodeAt(0)),
        ...Array.from(`Printer: ${printer.name || 'Terminal Thermal'}\r\n`).map(c => c.charCodeAt(0)),
        ...Array.from(`Interface: ${printer.connectionType.toUpperCase()}\r\n`).map(c => c.charCodeAt(0)),
        ...Array.from(`Width: ${printer.paperWidth || 58}mm\r\n`).map(c => c.charCodeAt(0)),
        ...Array.from(`Timestamp: ${new Date().toLocaleTimeString()}\r\n`).map(c => c.charCodeAt(0)),
        ...Array.from('--------------------------------\r\n').map(c => c.charCodeAt(0)),
        ...Array.from('✓ HARDWARE PRINT SUCCESSFUL!\r\n').map(c => c.charCodeAt(0)),
        ...Array.from('--------------------------------\r\n\r\n\r\n\r\n').map(c => c.charCodeAt(0))
      ]);

      const res = await NativeBridgeService.printer.print(
        printer.connectionType,
        targetId,
        testBytes,
        printer.port || 9100
      );

      if (res.success) {
        return { success: true, message: `Test receipt printed successfully on ${printer.name || 'printer'}.` };
      }
      return { success: false, error: res.error || 'Test print transmission failed.' };
    },

    testX6hHardware: async (targetIdentifier: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.testX6hHardware) {
        return { success: false, error: 'X6h hardware driver is only available in Native Android mode.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.testX6hHardware!(targetIdentifier, callbackId);
      });
    },

    testBleWrite: async (targetIdentifier: string): Promise<{ success: boolean; message?: string; error?: string; statusCode?: number; statusDescription?: string; writeType?: string; bytesSent?: number; characteristic?: string }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.testBleWrite) {
        return { success: false, error: 'BLE write diagnostic is only available in Native Android mode.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.testBleWrite!(targetIdentifier, callbackId);
      });
    },

    getGattDiagnostic: async (targetIdentifier: string): Promise<{ success: boolean; diagnostic?: any; error?: string }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.getGattDiagnostic) {
        return { success: false, error: 'GATT diagnostic inspection is only available in Native Android mode.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.getGattDiagnostic!(targetIdentifier, callbackId);
      });
    },

    /**
     * Query integrated built-in POS terminal printer (Sunmi / Handheld POS)
     */
    getBuiltInPrinter: (): any | null => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.getBuiltInPrinter) {
        return null;
      }
      try {
        const raw = window.AndroidPOSNative.getBuiltInPrinter();
        const parsed = JSON.parse(raw);
        if (parsed && parsed.status === 'ONLINE') {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    },

    /**
     * Spool receipt via Android Native System PrintManager
     */
    printSystemSpooler: async (title: string, receiptText: string): Promise<{ success: boolean; error?: string }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.printViaSystemSpooler) {
        return {
          success: false,
          error: 'Android PrintManager service is not available.'
        };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.printViaSystemSpooler!(title, receiptText, callbackId);
      });
    }
  };

  // --------------------------------------------------------------------------
  // Centralized Barcode Scanner Bridge (Section 19)
  // --------------------------------------------------------------------------
  static barcode = {
    startScanner: (onBarcodeScanned: (barcode: string) => void): (() => void) => {
      if (NativeBridgeService.isNativeAndroid()) {
        window.AndroidPOSNative!.startBarcodeScanner();
      }

      if (window.__AuraPOSEventBus) {
        return window.__AuraPOSEventBus.on('onBarcodeScanned', (payload: any) => {
          const barcode = typeof payload === 'string' ? JSON.parse(payload).barcode : payload.barcode;
          if (barcode) {
            onBarcodeScanned(barcode);
          }
        });
      }

      return () => {};
    },

    stopScanner: (): void => {
      if (NativeBridgeService.isNativeAndroid()) {
        window.AndroidPOSNative!.stopBarcodeScanner();
      }
    }
  };

  // --------------------------------------------------------------------------
  // Centralized Cash Drawer Bridge (Section 20)
  // --------------------------------------------------------------------------
  static cashDrawer = {
    open: async (
      printerType: string,
      targetIdentifier: string,
      port: number = 9100
    ): Promise<{ success: boolean; error?: string }> => {
      if (!NativeBridgeService.isNativeAndroid()) {
        return {
          success: false,
          error: 'Native Android hardware is unavailable in browser preview.'
        };
      }

      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.openCashDrawer(printerType, targetIdentifier, port, callbackId);
      });
    }
  };

  // --------------------------------------------------------------------------
  // Hardware Diagnostics (Section 32)
  // --------------------------------------------------------------------------
  static diagnostics = {
    getDiagnostics: (): HardwareDiagnosticsResult => {
      if (!NativeBridgeService.isNativeAndroid()) {
        return {
          isNativeAndroid: false,
          statusMessage: 'Running in Web Browser Preview. Physical Bluetooth, USB, and LAN printer sockets require running inside the AuraPOS Android Shell.'
        };
      }

      try {
        const raw = window.AndroidPOSNative!.getDiagnostics();
        return JSON.parse(raw);
      } catch (e: any) {
        return {
          isNativeAndroid: true,
          statusMessage: `Diagnostics error: ${e.message}`
        };
      }
    }
  };

  // --------------------------------------------------------------------------
  // AI Backend Connectivity Diagnostics (Requirement 3 & 4)
  // --------------------------------------------------------------------------
  static backendDiagnostics = {
    testConnection: async (targetUrl: string): Promise<BackendHealthCheckResult> => {
      const cleanUrl = targetUrl.trim().replace(/\/+$/, '');
      const healthEndpoint =
        cleanUrl.endsWith('/api/health') || cleanUrl.endsWith('/health')
          ? cleanUrl
          : `${cleanUrl}/api/health`;

      // 1. If running inside native Android POS shell with NativeBridge:
      if (
        NativeBridgeService.isNativeAndroid() &&
        window.AndroidPOSNative?.checkBackendHealth
      ) {
        try {
          return await NativeBridgeService.callNativeAsync<BackendHealthCheckResult>(callbackId => {
            window.AndroidPOSNative!.checkBackendHealth!(healthEndpoint, callbackId);
          }, 15000);
        } catch (e: any) {
          console.warn('Native checkBackendHealth failed, falling back to web fetch:', e);
        }
      }

      // 2. Browser / WebView fetch fallback:
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(healthEndpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - startTime);

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            status: response.status,
            latencyMs,
            dnsOk: true,
            tlsOk: healthEndpoint.startsWith('https://'),
            aiServiceAvailable: data?.aiServiceAvailable ?? true,
            service: data?.service || 'AuraPOS AI Backend',
            timestamp: new Date().toISOString()
          };
        } else {
          return {
            success: false,
            status: response.status,
            latencyMs,
            dnsOk: true,
            tlsOk: healthEndpoint.startsWith('https://'),
            aiServiceAvailable: false,
            error: `Server responded with HTTP ${response.status}: ${response.statusText}`,
            errorType: `HTTP_${response.status}`,
            timestamp: new Date().toISOString()
          };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - startTime);
        let errorType = 'BACKEND_UNREACHABLE';
        let errorMsg = 'Could not establish connection to the AuraPOS AI backend.';

        if (err.name === 'AbortError') {
          errorType = 'BACKEND_TIMEOUT';
          errorMsg = 'Health check connection timed out after 12 seconds.';
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          errorType = 'NO_INTERNET';
          errorMsg = 'Device is offline. An active network connection is required.';
        } else if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
          errorType = 'BACKEND_UNREACHABLE';
          errorMsg = 'Could not establish connection to the AuraPOS AI backend. Please verify your backend server URL.';
        } else if (err.message) {
          errorMsg = err.message;
        }

        return {
          success: false,
          status: 0,
          latencyMs,
          dnsOk: errorType !== 'BACKEND_UNREACHABLE' ? true : undefined,
          tlsOk: healthEndpoint.startsWith('https://'),
          aiServiceAvailable: false,
          error: errorMsg,
          errorType,
          timestamp: new Date().toISOString()
        };
      }
    }
  };

  // --------------------------------------------------------------------------
  // AI & Local-First Menu Scanner Native Bridge Forwarder (Requirements 1-9, 15)
  // --------------------------------------------------------------------------
  static menuScanner = {
    hasNativeScanner: (): boolean => {
      return (
        NativeBridgeService.isNativeAndroid() &&
        !!window.AndroidPOSNative?.recognizeMenuLocal
      );
    },

    launchNativeCamera: async (): Promise<{
      success: boolean;
      pages?: any[];
      cancelled?: boolean;
      error?: string;
    }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.launchNativeCamera) {
        return { success: false, error: 'Native Android camera is not available in browser mode.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.launchNativeCamera!(callbackId);
      }, 60000);
    },

    launchNativeGallery: async (allowMultiple: boolean = true): Promise<{
      success: boolean;
      pages?: any[];
      cancelled?: boolean;
      error?: string;
    }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.launchNativeGallery) {
        return { success: false, error: 'Native Android photo picker is not available in browser mode.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.launchNativeGallery!(allowMultiple, callbackId);
      }, 60000);
    },

    importPdfMenu: async (base64Pdf: string): Promise<{
      success: boolean;
      pages?: any[];
      error?: string;
    }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.importPdfMenu) {
        return { success: false, error: 'Native Android PDF renderer is not available in browser mode.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.importPdfMenu!(base64Pdf, callbackId);
      }, 90000);
    },

    preprocessImageLocal: async (
      base64Image: string,
      rotation: number = 0
    ): Promise<{
      success: boolean;
      originalDataUrl?: string;
      processedOcrDataUrl?: string;
      width?: number;
      height?: number;
      error?: string;
    }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.preprocessImageLocal) {
        return { success: false, error: 'Native image preprocessor is not available.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.preprocessImageLocal!(base64Image, rotation, callbackId);
      }, 30000);
    },

    recognizeMenuLocal: async (
      base64Image: string,
      pageNumber: number = 1
    ): Promise<{
      success: boolean;
      categories?: any[];
      products?: any[];
      ocrResult?: any;
      processedOcrDataUrl?: string;
      detectedCurrency?: string;
      menuTitle?: string;
      error?: string;
      durationMs?: number;
    }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.recognizeMenuLocal) {
        return { success: false, error: 'Native ML Kit OCR is unavailable.' };
      }
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.recognizeMenuLocal!(base64Image, pageNumber, callbackId);
      }, 45000);
    },

    batchImportToDatabase: async (
      categories: any[],
      products: any[],
      storeId: string = 'store_aura_main'
    ): Promise<{
      success: boolean;
      importedCategories?: number;
      importedProducts?: number;
      updatedProducts?: number;
      error?: string;
    }> => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.batchImportToDatabase) {
        return { success: false, error: 'Native database import is unavailable.' };
      }
      const payload = JSON.stringify({ categories, products, storeId });
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.batchImportToDatabase!(payload, callbackId);
      }, 30000);
    },

    analyzeMenuViaNative: async (
      payloadJson: string
    ): Promise<{ success: boolean; data?: any; error?: string }> => {
      if (
        !NativeBridgeService.isNativeAndroid() ||
        !window.AndroidPOSNative?.analyzeMenu
      ) {
        return {
          success: false,
          error: 'Native Android menu scanner is unavailable.'
        };
      }

      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.analyzeMenu!(payloadJson, callbackId);
      }, 120000);
    }
  };

  // --------------------------------------------------------------------------
  // Native Accessibility & Haptics (Section 11 & 20)
  // --------------------------------------------------------------------------
  static accessibility = {
    vibrate: (durationMs: number = 50) => {
      if (NativeBridgeService.isNativeAndroid() && window.AndroidPOSNative?.vibrate) {
        try {
          window.AndroidPOSNative.vibrate(durationMs);
          return;
        } catch (e) {
          console.warn('Native vibrate call failed:', e);
        }
      }
      // Web Fallback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(durationMs);
        } catch {}
      }
    },

    announce: (text: string) => {
      if (NativeBridgeService.isNativeAndroid() && window.AndroidPOSNative?.announceForAccessibility) {
        try {
          window.AndroidPOSNative.announceForAccessibility(text);
          return;
        } catch (e) {
          console.warn('Native accessibility announcement failed:', e);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // Phase 3: Android Native Local Database & Sync Bridge
  // --------------------------------------------------------------------------
  static localDb = {
    getTerminalIdentity: (): { storeId: string; terminalId: string; deviceInstallationId: string; state: string } | null => {
      if (!NativeBridgeService.isNativeAndroid() || !window.AndroidPOSNative?.localDbGetTerminalIdentity) {
        return null;
      }
      try {
        const raw = window.AndroidPOSNative.localDbGetTerminalIdentity();
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    getProducts: (query: string = ''): Promise<{ success: boolean; products: any[]; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetProducts!(query, callbackId);
      });
    },

    getProductByBarcode: (barcode: string): Promise<{ success: boolean; product: any; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetProductByBarcode!(barcode, callbackId);
      });
    },

    getCategories: (): Promise<{ success: boolean; categories: any[]; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetCategories!(callbackId);
      });
    },

    getCustomers: (query: string = ''): Promise<{ success: boolean; customers: any[]; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetCustomers!(query, callbackId);
      });
    },

    saveCustomer: (customerJson: any): Promise<{ success: boolean; customerId?: string; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbSaveCustomer!(JSON.stringify(customerJson), callbackId);
      });
    },

    recordSaleAtomic: (sale: any): Promise<{ success: boolean; saleId?: string; receiptNumber?: string; syncStatus?: string; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbRecordSale!(JSON.stringify(sale), callbackId);
      });
    },

    getSales: (limit: number = 50, offset: number = 0): Promise<{ success: boolean; sales: any[]; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetSales!(limit, offset, callbackId);
      });
    },

    getPendingSyncCount: (): Promise<{ success: boolean; pendingCount: number }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetPendingSyncCount!(callbackId);
      });
    },

    getSyncStatus: (): Promise<any> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetSyncStatus!(callbackId);
      });
    },

    triggerSync: (): Promise<any> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbTriggerSync!(callbackId);
      });
    },

    retrySync: (): Promise<any> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbRetrySync!(callbackId);
      });
    },

    getSyncEvents: (status: string = 'PENDING', limit: number = 50): Promise<{ success: boolean; events: any[]; error?: string }> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetSyncEvents!(status, limit, callbackId);
      });
    },

    getLocalReports: (dateFrom: string, dateTo: string): Promise<any> => {
      return NativeBridgeService.callNativeAsync(callbackId => {
        window.AndroidPOSNative!.localDbGetLocalReports!(dateFrom, dateTo, callbackId);
      });
    }
  };
}
