/**
 * Android WebView Native Bridge Service
 * Provides bidirectional communication with Android hardware peripherals:
 * - Camera Barcode Scanner
 * - Native Integrated Thermal Printer (Sunmi, Pax, Elo, etc.)
 * - Cash Drawer Kick
 * - Hardware Device Information & Battery Monitoring
 */

export interface NativeBridgeDeviceInfo {
  isAndroid: boolean;
  hasNativePrinter: boolean;
  hasNativeScanner: boolean;
  hasCashDrawer: boolean;
  batteryLevel?: number;
  terminalModel?: string;
}

export class NativeBridgeService {
  private static instance: NativeBridgeService;

  private constructor() {
    this.initListeners();
  }

  public static getInstance(): NativeBridgeService {
    if (!NativeBridgeService.instance) {
      NativeBridgeService.instance = new NativeBridgeService();
    }
    return NativeBridgeService.instance;
  }

  private initListeners() {
    if (typeof window === 'undefined') return;

    // Listen for barcode scan callbacks dispatched from Android WebView
    window.addEventListener('androidBarcodeScanned', ((event: CustomEvent) => {
      const barcode = event.detail?.barcode;
      if (barcode) {
        window.dispatchEvent(new CustomEvent('loyverseNativeBarcode', { detail: { barcode } }));
      }
    }) as EventListener);
  }

  /**
   * Check if running inside Android WebView with Native Bridge available
   */
  public isBridgeAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).AndroidBridge || !!(window as any).SunmiBridge;
  }

  /**
   * Get connected native hardware capability info
   */
  public getDeviceInfo(): NativeBridgeDeviceInfo {
    if (typeof window === 'undefined') {
      return { isAndroid: false, hasNativePrinter: false, hasNativeScanner: false, hasCashDrawer: false };
    }

    const bridge = (window as any).AndroidBridge;
    if (!bridge) {
      const isAndroidUserAgent = /Android/i.test(navigator.userAgent);
      return {
        isAndroid: isAndroidUserAgent,
        hasNativePrinter: false,
        hasNativeScanner: isAndroidUserAgent,
        hasCashDrawer: false,
      };
    }

    return {
      isAndroid: true,
      hasNativePrinter: typeof bridge.printRaw === 'function' || typeof bridge.printReceipt === 'function',
      hasNativeScanner: typeof bridge.scanBarcode === 'function',
      hasCashDrawer: typeof bridge.openCashDrawer === 'function',
      terminalModel: bridge.getDeviceModel ? bridge.getDeviceModel() : 'Android POS Terminal',
      batteryLevel: bridge.getBatteryPercentage ? bridge.getBatteryPercentage() : undefined,
    };
  }

  /**
   * Launch native Android Camera Barcode Scanner
   */
  public async scanBarcodeWithCamera(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.scanBarcode === 'function') {
      return new Promise((resolve) => {
        const handleScan = (e: any) => {
          window.removeEventListener('androidBarcodeResult', handleScan);
          resolve(e.detail?.barcode || null);
        };
        window.addEventListener('androidBarcodeResult', handleScan);
        bridge.scanBarcode();

        // 30 second timeout safety
        setTimeout(() => {
          window.removeEventListener('androidBarcodeResult', handleScan);
          resolve(null);
        }, 30000);
      });
    }

    console.warn('Native camera barcode scanner bridge not attached.');
    return null;
  }

  /**
   * Send binary or formatted text to native thermal printer
   */
  public async printThermalReceipt(receiptData: string, isEscPos: boolean = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const bridge = (window as any).AndroidBridge;
    if (bridge) {
      if (isEscPos && typeof bridge.printRawHex === 'function') {
        bridge.printRawHex(receiptData);
        return true;
      }
      if (typeof bridge.printReceipt === 'function') {
        bridge.printReceipt(receiptData);
        return true;
      }
    }

    // Sunmi POS terminal bridge fallback
    const sunmi = (window as any).SunmiBridge;
    if (sunmi && typeof sunmi.printText === 'function') {
      sunmi.printText(receiptData);
      return true;
    }

    return false;
  }

  /**
   * Trigger native cash drawer kick pulse
   */
  public openCashDrawer(): boolean {
    if (typeof window === 'undefined') return false;

    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.openCashDrawer === 'function') {
      bridge.openCashDrawer();
      return true;
    }

    const sunmi = (window as any).SunmiBridge;
    if (sunmi && typeof sunmi.openCashDrawer === 'function') {
      sunmi.openCashDrawer();
      return true;
    }

    return false;
  }

  /**
   * Trigger native paper cutter
   */
  public cutPaper(): boolean {
    if (typeof window === 'undefined') return false;

    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.cutPaper === 'function') {
      bridge.cutPaper();
      return true;
    }

    return false;
  }
}

export const nativeBridgeService = NativeBridgeService.getInstance();
