/**
 * ESC/POS Command Generator & Column Layout Engine
 * Converts high-level receipt commands into binary ESC/POS byte streams.
 * Includes column formatting and text word-wrapping tailored for 58mm and 80mm paper widths.
 */

export type Alignment = 'left' | 'center' | 'right';
export type FontSize = 'normal' | 'double_width' | 'double_height' | 'large';

export interface ColumnDefinition {
  text: string;
  widthChars?: number; // exact width in characters
  align?: Alignment;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private previewLines: string[] = [];
  private charactersPerLine: number;
  private currentAlign: Alignment = 'left';

  constructor(charactersPerLine = 32) {
    this.charactersPerLine = charactersPerLine;
    this.initialize();
  }

  /**
   * Set characters per line for paper width (e.g. 32 for 58mm, 48 for 80mm)
   */
  setColumnsPerLine(chars: number): this {
    this.charactersPerLine = chars;
    return this;
  }

  getColumnsPerLine(): number {
    return this.charactersPerLine;
  }

  /**
   * ESC @ - Initialize printer hardware
   */
  initialize(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  /**
   * ESC a n - Select justification: 0=Left, 1=Center, 2=Right
   */
  setAlignment(alignment: Alignment): this {
    this.currentAlign = alignment;
    const n = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, n);
    return this;
  }

  /**
   * ESC E n - Turn emphasized (bold) mode on/off
   */
  setBold(bold: boolean): this {
    this.buffer.push(0x1b, 0x45, bold ? 1 : 0);
    return this;
  }

  /**
   * ESC - n - Turn underline mode on/off
   */
  setUnderline(underline: boolean): this {
    this.buffer.push(0x1b, 0x2d, underline ? 1 : 0);
    return this;
  }

  /**
   * GS ! n - Select character size
   */
  setFontSize(size: FontSize): this {
    let n = 0x00;
    if (size === 'double_width') n = 0x20;
    else if (size === 'double_height') n = 0x01;
    else if (size === 'large') n = 0x11; // 2x width & 2x height
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  /**
   * Appends raw text
   */
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      // Map basic ASCII or pass UTF-8 byte
      if (charCode < 128) {
        this.buffer.push(charCode);
      } else {
        // Simple fallback UTF-8 encode
        const encoded = new TextEncoder().encode(str[i]);
        encoded.forEach(b => this.buffer.push(b));
      }
    }
    return this;
  }

  /**
   * Appends text with a newline (CR LF: 0x0D, 0x0A) for universal line buffer flushing
   */
  line(str = ''): this {
    if (str) {
      this.text(str);
      this.previewLines.push(this.formatPreviewLine(str, this.currentAlign));
    } else {
      this.previewLines.push('');
    }
    this.buffer.push(0x0d, 0x0a); // CR LF
    return this;
  }

  /**
   * Print and feed n lines
   */
  feed(lines = 1): this {
    const count = Math.max(1, lines);
    for (let i = 0; i < count; i++) {
      this.previewLines.push('');
      this.buffer.push(0x0d, 0x0a);
    }
    return this;
  }

  /**
   * Print repeated separator line (e.g. "--------------------------------")
   */
  separator(char = '-'): this {
    const sep = char.repeat(this.charactersPerLine);
    this.line(sep);
    return this;
  }

  /**
   * Print double-line separator (e.g. "================================")
   */
  doubleSeparator(char = '='): this {
    return this.separator(char);
  }

  /**
   * Reusable multi-column layout engine with word wrapping.
   * Prevents long product names from overflowing paper width.
   * e.g.
   * Coffee            2    $3.50
   * Artisan Bread     1    $5.00
   * with Herb Butter
   */
  columns(cols: ColumnDefinition[]): this {
    if (cols.length === 0) return this;

    // If widths not explicitly supplied, divide dynamically
    // Typical POS: Item (remaining width), Qty (3-4 chars), Price (7-8 chars)
    const totalChars = this.charactersPerLine;
    let specifiedWidthsSum = 0;
    let unassignedColsCount = 0;

    cols.forEach(c => {
      if (c.widthChars && c.widthChars > 0) {
        specifiedWidthsSum += c.widthChars;
      } else {
        unassignedColsCount++;
      }
    });

    const defaultUnassignedWidth = Math.max(
      4,
      Math.floor((totalChars - specifiedWidthsSum) / Math.max(1, unassignedColsCount))
    );

    const calculatedWidths = cols.map((c, idx) => {
      if (c.widthChars && c.widthChars > 0) return c.widthChars;
      if (idx === cols.length - 1) {
        // Last column absorbs any remaining single character
        return Math.max(4, totalChars - specifiedWidthsSum - (unassignedColsCount - 1) * defaultUnassignedWidth);
      }
      return defaultUnassignedWidth;
    });

    // Word-wrap each column's text into lines
    const wrappedColumnLines: string[][] = cols.map((c, idx) => {
      const width = calculatedWidths[idx];
      return this.wrapText(c.text, width);
    });

    // Determine the max number of lines any column takes
    const maxLines = Math.max(...wrappedColumnLines.map(lines => lines.length));

    // Print line by line
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      let combinedLine = '';
      cols.forEach((c, colIdx) => {
        const width = calculatedWidths[colIdx];
        const align = c.align || (colIdx === cols.length - 1 ? 'right' : 'left');
        const textSegment = wrappedColumnLines[colIdx][lineIdx] || '';
        combinedLine += this.padString(textSegment, width, align);
      });

      this.line(combinedLine);
    }

    return this;
  }

  /**
   * GS V m n - Partial or full paper cut
   */
  cut(partial = false): this {
    // Feed 3 lines before cut so content clears thermal head
    this.buffer.push(0x1b, 0x64, 3);
    // GS V 66 0 = Partial cut with feed; GS V 65 0 = Full cut
    this.buffer.push(0x1d, 0x56, partial ? 0x42 : 0x41, 0x00);
    this.previewLines.push('[--- PAPER CUT ---]');
    return this;
  }

  /**
   * ESC p m t1 t2 - Pulse cash drawer kick-out pin
   * m=0 for pin 2, m=1 for pin 5
   */
  cashDrawerPulse(pin: 2 | 5 = 2): this {
    const m = pin === 5 ? 1 : 0;
    // t1=25 (50ms on), t2=250 (500ms off)
    this.buffer.push(0x1b, 0x70, m, 25, 250);
    return this;
  }

  /**
   * GS k m d1...dk NUL - Print 1D Barcode (CODE128 or EAN13)
   */
  barcode(data: string, type: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' = 'CODE128'): this {
    this.setAlignment('center');
    // Set barcode height = 60 dots
    this.buffer.push(0x1d, 0x68, 60);
    // Set HRI (text) position below barcode
    this.buffer.push(0x1d, 0x48, 2);

    if (type === 'CODE128') {
      // GS k 73 len {B data}
      const rawData = `{B${data}`;
      this.buffer.push(0x1d, 0x6b, 73, rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        this.buffer.push(rawData.charCodeAt(i));
      }
    } else {
      // Standard CODE39 or simple barcode
      this.buffer.push(0x1d, 0x6b, 69, data.length);
      for (let i = 0; i < data.length; i++) {
        this.buffer.push(data.charCodeAt(i));
      }
    }

    this.line();
    this.previewLines.push(`[BARCODE: ${data}]`);
    return this;
  }

  /**
   * Native QR Code command (Model 2)
   */
  qrCode(data: string, size = 6): this {
    this.setAlignment('center');
    const storeLen = data.length + 3;
    const pL = storeLen % 256;
    const pH = Math.floor(storeLen / 256);

    // 1. Model type (Model 2)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Module size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(8, Math.max(2, size)));
    // 3. Error correction level (M = 49)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store data in symbol storage area
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    // 5. Print stored symbol
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

    this.line();
    this.previewLines.push(`[QR CODE: ${data}]`);
    return this;
  }

  /**
   * Get raw byte sequence ready to transmit to Bluetooth, USB, or TCP 9100 socket
   */
  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Base64 representation for network bridge payloads or storage
   */
  toBase64(): string {
    const bytes = this.toBytes();
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Render complete receipt preview text for debugging and fallback
   */
  toPreviewText(): string {
    return this.previewLines.join('\n');
  }

  // --- Helper Layout Methods ---

  private wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [''];
    if (text.length <= maxWidth) return [text];

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        // If single word exceeds maxWidth, slice it
        if (word.length > maxWidth) {
          let remainder = word;
          while (remainder.length > maxWidth) {
            lines.push(remainder.substring(0, maxWidth));
            remainder = remainder.substring(maxWidth);
          }
          currentLine = remainder;
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  private padString(str: string, width: number, align: Alignment): string {
    if (str.length >= width) return str.substring(0, width);
    const diff = width - str.length;

    if (align === 'right') {
      return ' '.repeat(diff) + str;
    }
    if (align === 'center') {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    }
    return str + ' '.repeat(diff);
  }

  private formatPreviewLine(str: string, align: Alignment): string {
    return this.padString(str, this.charactersPerLine, align);
  }
}
