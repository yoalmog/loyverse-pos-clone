import { Sale, CartItem, StoreSettings } from '../../types/pos.ts';
import { PaperWidthMm, PrinterEncoding } from '../../types/printer.ts';

export interface EscPosRenderOptions {
  paperWidth?: PaperWidthMm;
  charactersPerLine?: number;
  encoding?: PrinterEncoding;
  cutPaper?: boolean;
  kickDrawer?: boolean;
  showBarcode?: boolean;
  showQr?: boolean;
}

/**
 * AuraPOS Unified ESC/POS Rendering Engine
 * Conforming to Section 9:
 * Produces raw ESC/POS byte buffers that work interchangeably over:
 * - Bluetooth (X18 Mini & generic BLE/SPP)
 * - LAN / Wi-Fi TCP Port 9100
 * - USB Host
 */
export class EscPosRenderer {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  // -------------------------------------------------------------
  // Low-level ESC/POS Commands
  // -------------------------------------------------------------

  init(): this {
    // ESC @ (Initialize printer)
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  align(alignment: 'left' | 'center' | 'right'): this {
    // ESC a n (0: Left, 1: Center, 2: Right)
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1B, 0x61, val);
    return this;
  }

  bold(enable: boolean): this {
    // ESC E n (1: On, 0: Off)
    this.buffer.push(0x1B, 0x45, enable ? 1 : 0);
    return this;
  }

  doubleHeightWidth(enable: boolean): this {
    // GS ! n
    this.buffer.push(0x1D, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else {
        // Fallback ASCII representation or CP437 mapping
        this.buffer.push(0x3F); // '?' or custom code page mapping
      }
    }
    return this;
  }

  line(str: string = ''): this {
    if (str) this.text(str);
    this.buffer.push(0x0A); // LF
    return this;
  }

  separator(char: string = '-', width: number = 32): this {
    this.line(char.repeat(width));
    return this;
  }

  twoColumns(left: string, right: string, width: number = 32): this {
    const spaceCount = Math.max(1, width - left.length - right.length);
    this.line(left + ' '.repeat(spaceCount) + right);
    return this;
  }

  feed(lines: number = 3): this {
    // ESC d n
    this.buffer.push(0x1B, 0x64, lines);
    return this;
  }

  cut(full: boolean = false): this {
    // GS V m
    this.buffer.push(0x1D, 0x56, full ? 0x00 : 0x01);
    return this;
  }

  pulseDrawer(): this {
    // ESC p m t1 t2 (Kick cash drawer pin 2)
    this.buffer.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  barcode(data: string): this {
    // GS k m (CODE128)
    const cleanData = data.replace(/[^A-Za-z0-9]/g, '');
    if (!cleanData) return this;

    this.align('center');
    // Set barcode height = 64 dots (GS h 64)
    this.buffer.push(0x1D, 0x68, 64);
    // Set HRI characters below barcode (GS H 2)
    this.buffer.push(0x1D, 0x48, 2);
    // Barcode type CODE128 (GS k 73 len bytes...)
    this.buffer.push(0x1D, 0x6B, 73, cleanData.length);
    for (let i = 0; i < cleanData.length; i++) {
      this.buffer.push(cleanData.charCodeAt(i));
    }
    this.line();
    this.align('left');
    return this;
  }

  qrCode(data: string): this {
    if (!data) return this;
    const len = data.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    this.align('center');
    // QR Code Model 2
    this.buffer.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // QR Code Module size (4 dots)
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04);
    // Error correction level L
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30);
    // Store data in symbol storage
    this.buffer.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    // Print symbol
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.line();
    this.align('left');
    return this;
  }

  /**
   * ESC/POS standard raster bit image (GS v 0 m xL xH yL yH d1...dk)
   */
  rasterBitmap(raster: { width: number; height: number; bytesPerRow: number; data: Uint8Array }): this {
    if (!raster || !raster.data || raster.data.length === 0) return this;

    this.align('center');
    const xL = raster.bytesPerRow % 256;
    const xH = Math.floor(raster.bytesPerRow / 256);
    const yL = raster.height % 256;
    const yH = Math.floor(raster.height / 256);

    // GS v 0 0 xL xH yL yH
    this.buffer.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    for (let i = 0; i < raster.data.length; i++) {
      this.buffer.push(raster.data[i]);
    }
    this.line();
    this.align('left');
    return this;
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  // -------------------------------------------------------------
  // High-level Business Document Generators
  // -------------------------------------------------------------

  /**
   * Render complete customer sales receipt with optional real Yape / Plin QR payment image
   */
  static renderCustomerReceipt(
    sale: Sale,
    settings: StoreSettings,
    options: EscPosRenderOptions & {
      qrRaster?: { width: number; height: number; bytesPerRow: number; data: Uint8Array } | null;
      qrLabel?: string;
      qrInstructions?: string;
      qrPosition?: 'BEFORE_TOTAL' | 'AFTER_TOTAL' | 'AFTER_PAYMENT' | 'BOTTOM';
    } = {}
  ): { bytes: Uint8Array; previewText: string } {
    const width = options.charactersPerLine || (options.paperWidth === 80 ? 48 : 32);
    const renderer = new EscPosRenderer();
    const textLines: string[] = [];

    const qrPosition = options.qrPosition || 'AFTER_PAYMENT';

    // Helper to print the real QR image section
    const appendQrSection = () => {
      if (!options.qrRaster) return;

      renderer.feed(1).align('center');
      renderer.bold(true);
      const label = options.qrLabel || 'PAY WITH QR';
      renderer.line(`*** ${label.toUpperCase()} ***`);
      textLines.push(`*** ${label.toUpperCase()} ***`);
      renderer.bold(false);

      // Print real ESC/POS raster bitmap
      renderer.rasterBitmap(options.qrRaster);
      textLines.push('[REAL QR IMAGE PRINTED]');

      if (options.qrInstructions) {
        renderer.align('center').line(options.qrInstructions);
        textLines.push(options.qrInstructions);
      }
      renderer.feed(1).align('left');
    };

    // 1. Header & Store Info
    renderer.align('center').bold(true).doubleHeightWidth(true);
    const storeName = settings.name || 'AuraPOS Store';
    renderer.line(storeName);
    textLines.push(storeName);

    renderer.doubleHeightWidth(false).bold(false);
    if (settings.address) {
      renderer.line(settings.address);
      textLines.push(settings.address);
    }
    if (settings.phone) {
      renderer.line(`Tel: ${settings.phone}`);
      textLines.push(`Tel: ${settings.phone}`);
    }
    if (settings.receiptHeader) {
      renderer.line(settings.receiptHeader);
      textLines.push(settings.receiptHeader);
    }

    renderer.separator('=', width);
    textLines.push('='.repeat(width));

    // 2. Receipt metadata
    renderer.align('left');
    const recLine = `Receipt: ${sale.receiptNumber || sale.id}`;
    const dateLine = `Date: ${new Date(sale.createdAt).toLocaleString()}`;
    renderer.line(recLine).line(dateLine);
    textLines.push(recLine, dateLine);

    if (sale.employeeName) {
      const cashierLine = `Cashier: ${sale.employeeName}`;
      renderer.line(cashierLine);
      textLines.push(cashierLine);
    }

    if (sale.customerName) {
      const custLine = `Customer: ${sale.customerName}`;
      renderer.line(custLine);
      textLines.push(custLine);
    }

    renderer.separator('-', width);
    textLines.push('-'.repeat(width));

    // 3. Line Items
    sale.items.forEach(item => {
      const name = item.productName + (item.variantName ? ` (${item.variantName})` : '');
      const total = `${settings.currency || '$'}${item.lineTotal.toFixed(2)}`;
      renderer.twoColumns(`${item.quantity}x ${name}`, total, width);
      textLines.push(`${item.quantity}x ${name}`.padEnd(width - total.length) + total);

      if ((item as any).notes) {
        renderer.line(`  * Note: ${(item as any).notes}`);
        textLines.push(`  * Note: ${(item as any).notes}`);
      }
    });

    // BEFORE_TOTAL QR insertion
    if (qrPosition === 'BEFORE_TOTAL') {
      appendQrSection();
    }

    renderer.separator('-', width);
    textLines.push('-'.repeat(width));

    // 4. Totals
    const subtotalStr = `${settings.currency || '$'}${sale.subtotal.toFixed(2)}`;
    renderer.twoColumns('Subtotal:', subtotalStr, width);
    textLines.push('Subtotal:'.padEnd(width - subtotalStr.length) + subtotalStr);

    if (sale.discountAmount > 0) {
      const discStr = `-${settings.currency || '$'}${sale.discountAmount.toFixed(2)}`;
      renderer.twoColumns('Discount:', discStr, width);
      textLines.push('Discount:'.padEnd(width - discStr.length) + discStr);
    }

    if (sale.taxAmount > 0) {
      const taxStr = `${settings.currency || '$'}${sale.taxAmount.toFixed(2)}`;
      renderer.twoColumns('Tax:', taxStr, width);
      textLines.push('Tax:'.padEnd(width - taxStr.length) + taxStr);
    }

    renderer.separator('=', width);
    textLines.push('='.repeat(width));

    renderer.bold(true).doubleHeightWidth(true);
    const grandTotalStr = `${settings.currency || '$'}${sale.total.toFixed(2)}`;
    renderer.twoColumns('TOTAL:', grandTotalStr, width);
    textLines.push('TOTAL:'.padEnd(width - grandTotalStr.length) + grandTotalStr);
    renderer.doubleHeightWidth(false).bold(false);

    // AFTER_TOTAL QR insertion
    if (qrPosition === 'AFTER_TOTAL') {
      appendQrSection();
    }

    // 5. Payment details
    sale.payments.forEach(p => {
      const amtStr = `${settings.currency || '$'}${p.amount.toFixed(2)}`;
      const methodName = p.method === 'yape' ? 'YAPE' : p.method === 'plin' ? 'PLIN' : p.method.toUpperCase();
      renderer.twoColumns(`Paid (${methodName}):`, amtStr, width);
      textLines.push(`Paid (${methodName}):`.padEnd(width - amtStr.length) + amtStr);
    });

    // AFTER_PAYMENT QR insertion (Default)
    if (qrPosition === 'AFTER_PAYMENT') {
      appendQrSection();
    }

    // 6. Barcode / Receipt Lookup code
    if (options.showBarcode !== false) {
      renderer.feed(1);
      renderer.barcode(sale.receiptNumber || sale.id);
    }

    // BOTTOM QR insertion
    if (qrPosition === 'BOTTOM') {
      appendQrSection();
    }

    // 7. Footer
    renderer.feed(1).align('center');
    if (settings.receiptFooter) {
      renderer.line(settings.receiptFooter);
      textLines.push(settings.receiptFooter);
    }
    renderer.line('*** POWERED BY AURAPOS NATIVE ***');
    textLines.push('*** POWERED BY AURAPOS NATIVE ***');

    // 8. Feed, Cut & Cash Drawer Kick
    renderer.feed(3);
    if (options.cutPaper) {
      renderer.cut(false);
    }
    if (options.kickDrawer) {
      renderer.pulseDrawer();
    }

    return {
      bytes: renderer.toBytes(),
      previewText: textLines.join('\n')
    };
  }

  /**
   * Render QR test receipt
   */
  static renderQrTestReceipt(params: {
    providerName: string;
    accountHolder?: string;
    phoneAccount?: string;
    qrRaster?: { width: number; height: number; bytesPerRow: number; data: Uint8Array } | null;
    instructions?: string;
    charactersPerLine?: number;
  }): { bytes: Uint8Array; previewText: string } {
    const width = params.charactersPerLine || 32;
    const renderer = new EscPosRenderer();
    const textLines: string[] = [];

    renderer.align('center').bold(true).doubleHeightWidth(true);
    renderer.line(`*** ${params.providerName.toUpperCase()} TEST QR ***`);
    textLines.push(`*** ${params.providerName.toUpperCase()} TEST QR ***`);
    renderer.doubleHeightWidth(false).bold(false);

    renderer.line(`Date: ${new Date().toLocaleString()}`);
    textLines.push(`Date: ${new Date().toLocaleString()}`);

    if (params.accountHolder) {
      renderer.line(`Holder: ${params.accountHolder}`);
      textLines.push(`Holder: ${params.accountHolder}`);
    }
    if (params.phoneAccount) {
      renderer.line(`Account/Phone: ${params.phoneAccount}`);
      textLines.push(`Account/Phone: ${params.phoneAccount}`);
    }

    renderer.separator('=', width);
    textLines.push('='.repeat(width));

    if (params.qrRaster) {
      renderer.feed(1);
      renderer.rasterBitmap(params.qrRaster);
      textLines.push('[REAL CONFIGURED QR IMAGE]');
      renderer.feed(1);
    }

    renderer.align('center');
    renderer.line('Scan with your payment app');
    renderer.line('to verify test readability.');
    textLines.push('Scan with your payment app to verify test readability.');

    renderer.separator('=', width);
    textLines.push('='.repeat(width));
    renderer.feed(3).cut(false);

    return {
      bytes: renderer.toBytes(),
      previewText: textLines.join('\n')
    };
  }

  /**
   * Render order ticket for kitchen or bar stations
   */
  static renderStationTicket(params: {
    title: string;
    receiptNumber: string;
    createdAt: string;
    items: Array<{ productName: string; variantName?: string; quantity: number; notes?: string }>;
    notes?: string;
    charactersPerLine?: number;
    cutPaper?: boolean;
  }): { bytes: Uint8Array; previewText: string } {
    const width = params.charactersPerLine || 32;
    const renderer = new EscPosRenderer();
    const textLines: string[] = [];

    renderer.align('center').bold(true).doubleHeightWidth(true);
    renderer.line(`*** ${params.title.toUpperCase()} ORDER ***`);
    textLines.push(`*** ${params.title.toUpperCase()} ORDER ***`);

    renderer.doubleHeightWidth(false);
    renderer.line(`Ticket #: ${params.receiptNumber}`);
    renderer.line(`Time: ${new Date(params.createdAt).toLocaleTimeString()}`);
    textLines.push(`Ticket #: ${params.receiptNumber}`, `Time: ${new Date(params.createdAt).toLocaleTimeString()}`);

    renderer.separator('=', width);
    textLines.push('='.repeat(width));

    renderer.align('left').bold(true);
    params.items.forEach(item => {
      const name = item.productName + (item.variantName ? ` (${item.variantName})` : '');
      renderer.line(`${item.quantity}x ${name}`);
      textLines.push(`${item.quantity}x ${name}`);
      if (item.notes) {
        renderer.bold(false).line(`   >> NOTE: ${item.notes}`).bold(true);
        textLines.push(`   >> NOTE: ${item.notes}`);
      }
    });

    if (params.notes) {
      renderer.separator('-', width);
      renderer.bold(false).line(`Order Notes: ${params.notes}`);
      textLines.push(`Order Notes: ${params.notes}`);
    }

    renderer.feed(3);
    if (params.cutPaper) {
      renderer.cut(false);
    }

    return {
      bytes: renderer.toBytes(),
      previewText: textLines.join('\n')
    };
  }
}
