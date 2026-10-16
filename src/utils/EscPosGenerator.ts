/**
 * EscPosGenerator - ESC/POS Command Byte Generator & Column Layout Engine
 * Converts high-level receipt commands into binary Uint8Array ESC/POS byte streams.
 * Supports text formatting, dynamic multi-column wrapping, alignment, barcodes, QR codes,
 * drawer kicks, and paper cutting for 58mm, 76mm, and 80mm thermal receipt printers.
 */

export type Alignment = 'left' | 'center' | 'right';
export type FontSize = 'normal' | 'double_width' | 'double_height' | 'large';

export interface ColumnDefinition {
  text: string;
  width?: number; // character width
  widthChars?: number; // alias
  align?: Alignment;
}

export class EscPosGenerator {
  private buffer: number[] = [];
  private previewLines: string[] = [];
  private charactersPerLine: number;
  private currentAlign: Alignment = 'left';

  constructor(charactersPerLine = 48) {
    this.charactersPerLine = charactersPerLine;
    this.initialize();
  }

  /**
   * Configure character width for paper profile (e.g., 32 for 58mm, 48 for 80mm, 42 for 76mm)
   */
  setColumnsPerLine(chars: number): this {
    this.charactersPerLine = chars;
    return this;
  }

  getColumnsPerLine(): number {
    return this.charactersPerLine;
  }

  /**
   * ESC @ (0x1B, 0x40) - Initialize printer hardware and reset formatting registers
   */
  initialize(): this {
    this.buffer.push(0x1b, 0x40);
    this.currentAlign = 'left';
    return this;
  }

  /**
   * ESC a n (0x1B, 0x61, n) - Set text alignment: 0=Left, 1=Center, 2=Right
   */
  setAlignment(alignment: Alignment): this {
    this.currentAlign = alignment;
    const n = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, n);
    return this;
  }

  /**
   * ESC E n (0x1B, 0x45, n) - Emphasized / Bold text on/off
   */
  setBold(bold: boolean): this {
    this.buffer.push(0x1b, 0x45, bold ? 1 : 0);
    return this;
  }

  /**
   * ESC - n (0x1B, 0x2D, n) - Underline mode on/off (1=1 dot thick, 0=off)
   */
  setUnderline(underline: boolean): this {
    this.buffer.push(0x1b, 0x2d, underline ? 1 : 0);
    return this;
  }

  /**
   * GS ! n (0x1D, 0x21, n) - Select character font scaling
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
   * Append raw text string encoded into printer byte buffer
   */
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      if (charCode < 128) {
        this.buffer.push(charCode);
      } else {
        const encoded = new TextEncoder().encode(str[i]);
        encoded.forEach(b => this.buffer.push(b));
      }
    }
    return this;
  }

  /**
   * Append text followed by carriage return + line feed (CR LF: 0x0D, 0x0A)
   * Essential for hardware line buffer flushing on mobile and desktop thermal printers.
   */
  line(str = ''): this {
    if (str) {
      this.text(str);
      this.previewLines.push(this.formatPreviewLine(str, this.currentAlign));
    } else {
      this.previewLines.push('');
    }
    this.buffer.push(0x0d, 0x0a);
    return this;
  }

  /**
   * Print repeated single separator line (e.g. "--------------------------------")
   */
  separator(char = '-'): this {
    const sep = char.repeat(this.charactersPerLine);
    this.line(sep);
    return this;
  }

  /**
   * Print repeated double separator line (e.g. "================================")
   */
  doubleSeparator(char = '='): this {
    return this.separator(char);
  }

  /**
   * Reusable multi-column layout engine with automatic word wrapping.
   * Prevents long product names or notes from overflowing receipt paper width.
   * e.g.
   * Coffee            2    $3.50
   * Artisan Bread     1    $5.00
   * with Herb Butter
   */
  columns(cols: ColumnDefinition[]): this {
    if (cols.length === 0) return this;

    const totalChars = this.charactersPerLine;
    let specifiedWidthsSum = 0;
    let unassignedColsCount = 0;

    cols.forEach(c => {
      const w = c.width ?? c.widthChars;
      if (w && w > 0) {
        specifiedWidthsSum += w;
      } else {
        unassignedColsCount++;
      }
    });

    const defaultUnassignedWidth = Math.max(
      4,
      Math.floor((totalChars - specifiedWidthsSum) / Math.max(1, unassignedColsCount))
    );

    const calculatedWidths = cols.map((c, idx) => {
      const w = c.width ?? c.widthChars;
      if (w && w > 0) return w;
      if (idx === cols.length - 1) {
        // Last column absorbs any remaining single character
        return Math.max(4, totalChars - specifiedWidthsSum - (unassignedColsCount - 1) * defaultUnassignedWidth);
      }
      return defaultUnassignedWidth;
    });

    // Word-wrap each column's text into wrapped lines
    const wrappedColumnLines: string[][] = cols.map((c, idx) => {
      const width = calculatedWidths[idx];
      return this.wrapText(c.text, width);
    });

    // Determine the max height in lines required for this row
    const maxLines = Math.max(...wrappedColumnLines.map(lines => lines.length));

    // Emit line by line across all columns
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
   * Print and feed n lines using standard CR LF bytes and optional ESC d
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
   * GS V m n (0x1D, 0x56, m, n) - Partial or full paper cut
   */
  cut(partial = false): this {
    // Feed lines before cut so content clears thermal print head
    this.feed(3);
    // GS V 66 0 = Partial cut with feed; GS V 65 0 = Full cut
    this.buffer.push(0x1d, 0x56, partial ? 0x42 : 0x41, 0x00);
    this.previewLines.push('[--- PAPER CUT ---]');
    return this;
  }

  /**
   * ESC p m t1 t2 (0x1B, 0x70, m, t1, t2) - Pulse cash drawer kick-out pin
   * pin 2 (m=0) or pin 5 (m=1)
   */
  cashDrawerPulse(pin: 2 | 5 = 2): this {
    const m = pin === 5 ? 1 : 0;
    // t1=25 (50ms on pulse), t2=250 (500ms off delay)
    this.buffer.push(0x1b, 0x70, m, 25, 250);
    return this;
  }

  /**
   * GS k m d1...dk NUL - Print 1D Barcode (CODE128, EAN13, EAN8, UPC)
   */
  barcode(data: string, type: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' = 'CODE128'): this {
    this.setAlignment('center');
    // Set barcode height = 60 dots
    this.buffer.push(0x1d, 0x68, 60);
    // Set HRI (human readable interpretation text) position below barcode
    this.buffer.push(0x1d, 0x48, 2);

    if (type === 'CODE128') {
      const rawData = `{B${data}`;
      this.buffer.push(0x1d, 0x6b, 73, rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        this.buffer.push(rawData.charCodeAt(i));
      }
    } else {
      this.buffer.push(0x1d, 0x6b, 69, data.length);
      for (let i = 0; i < data.length; i++) {
        this.buffer.push(data.charCodeAt(i));
      }
      this.buffer.push(0x00);
    }

    this.previewLines.push(`[BARCODE ${type}: ${data}]`);
    this.line('');
    return this;
  }

  /**
   * Standard ESC/POS 2D QR Code sequence (Model 2, Error Correction Level M)
   */
  qrCode(data: string, size = 6): this {
    this.setAlignment('center');
    const dataLen = data.length + 3;
    const pL = dataLen % 256;
    const pH = Math.floor(dataLen / 256);

    // 1. Select QR Model 2: GS ( k 4 0 49 65 50 0
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Set Module Size: GS ( k 3 0 49 67 size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(8, Math.max(3, size)));
    // 3. Set Error Correction Level M (49): GS ( k 3 0 49 69 49
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store Data in QR Symbol Storage Area: GS ( k pL pH 49 80 48 d1...dk
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    // 5. Print Symbol: GS ( k 3 0 49 81 48
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

    this.previewLines.push(`[QR CODE: ${data}]`);
    return this;
  }

  /**
   * Returns a Uint8Array byte sequence that can be sent to printers by adapters
   */
  generate(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Alias for generate() to return Uint8Array
   */
  getBytes(): Uint8Array {
    return this.generate();
  }

  /**
   * Alias for generate()
   */
  toBytes(): Uint8Array {
    return this.generate();
  }

  /**
   * Base64 representation for network bridge payloads or local print spooler storage
   */
  toBase64(): string {
    const bytes = this.generate();
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Render complete text representation of receipt for visual inspection and modal display
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
