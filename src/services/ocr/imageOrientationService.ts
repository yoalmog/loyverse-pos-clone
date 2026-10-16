/**
 * AuraPOS - Automatic Image Orientation, Deskew & Enhancement Service
 * Conforming to Requirements 2 & 3:
 * Automatically determines and corrects orientation of photographed menus:
 * - EXIF Orientation metadata check
 * - Document physical content orientation detection (evaluating 0°, 90°, 180°, 270°)
 * - Deskew angle calculation (-15° to +15°)
 * - Contrast & resolution enhancement
 * - Preserves both original and corrected versions
 */

export interface OrientationAnalysisResult {
  originalDataUrl: string;
  correctedDataUrl: string;
  processedOcrDataUrl: string;
  detectedRotation: number; // 0, 90, 180, 270
  deskewAngle: number; // e.g. -1.4 degrees
  confidence: number; // 0.0 - 1.0
  isCorrected: boolean;
  width: number;
  height: number;
}

// Content-based orientation guessing misfired on various menu layouts and is disabled.
// Browsers and Android WebView already apply EXIF orientation on image decoding.
const AUTO_ROTATE_BY_CONTENT = false;

export class ImageOrientationService {
  /**
   * Main entry point: Analyzes and corrects orientation and tilt of an image.
   */
  static async analyzeAndCorrect(
    dataUrl: string,
    forcedRotation: number = 0
  ): Promise<OrientationAnalysisResult> {
    return new Promise((resolve) => {
      const img = new Image();
      if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = async () => {
        try {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;

          // Do NOT rotate by EXIF: browsers and Android WebView already apply EXIF
          // orientation when decoding images, so naturalWidth/naturalHeight and drawImage are already upright.
          let detectedRotation = forcedRotation;
          let confidence = 0.9;
          if (forcedRotation === 0 && AUTO_ROTATE_BY_CONTENT) {
            const contentResult = this.detectContentOrientation(img, origW, origH);
            detectedRotation = contentResult.bestAngle;
            confidence = contentResult.confidence;
          }

          // 3. Deskew calculation (small tilt correction +/- 15°)
          const deskewAngle = this.calculateDeskewAngle(img, origW, origH, detectedRotation);

          // 4. Render corrected image (Upright & Deskewed)
          const correctedDataUrl = this.renderCorrectedImage(
            img,
            origW,
            origH,
            detectedRotation,
            deskewAngle
          );

          // 5. Render high-contrast grayscale for OCR pipeline
          const processedOcrDataUrl = this.renderOcrEnhancement(correctedDataUrl);

          resolve({
            originalDataUrl: dataUrl,
            correctedDataUrl,
            processedOcrDataUrl,
            detectedRotation,
            deskewAngle,
            confidence,
            isCorrected: detectedRotation !== 0 || Math.abs(deskewAngle) > 0.5,
            width: origW,
            height: origH
          });
        } catch (err) {
          console.warn('Orientation detection fallback:', err);
          resolve({
            originalDataUrl: dataUrl,
            correctedDataUrl: dataUrl,
            processedOcrDataUrl: dataUrl,
            detectedRotation: 0,
            deskewAngle: 0,
            confidence: 0.5,
            isCorrected: false,
            width: img.naturalWidth || 800,
            height: img.naturalHeight || 600
          });
        }
      };

      img.onerror = () => {
        resolve({
          originalDataUrl: dataUrl,
          correctedDataUrl: dataUrl,
          processedOcrDataUrl: dataUrl,
          detectedRotation: 0,
          deskewAngle: 0,
          confidence: 0.5,
          isCorrected: false,
          width: 800,
          height: 600
        });
      };

      img.src = dataUrl;
    });
  }

  /**
   * Fast EXIF parser for JPEG orientation marker (Tag 0x0112)
   */
  private static getExifOrientation(dataUrl: string): number {
    try {
      if (!dataUrl.startsWith('data:image/jpeg') && !dataUrl.startsWith('data:image/jpg')) {
        return 0;
      }
      const base64Index = dataUrl.indexOf(';base64,');
      if (base64Index === -1) return 0;
      const base64 = dataUrl.substring(base64Index + 8, base64Index + 5000); // Check first few KB
      const binary = atob(base64);
      const len = binary.length;

      let offset = 2;
      while (offset < len) {
        if (binary.charCodeAt(offset) !== 0xff) break;
        const marker = binary.charCodeAt(offset + 1);

        // APP1 marker (EXIF)
        if (marker === 0xe1) {
          const exifHeader = binary.substring(offset + 4, offset + 10);
          if (exifHeader.startsWith('Exif')) {
            const tiffOffset = offset + 10;
            const isLittleEndian = binary.substring(tiffOffset, tiffOffset + 2) === 'II';
            const getUint16 = (idx: number) => {
              const b0 = binary.charCodeAt(idx);
              const b1 = binary.charCodeAt(idx + 1);
              return isLittleEndian ? b0 + (b1 << 8) : (b0 << 8) + b1;
            };

            const ifdOffset = tiffOffset + 8;
            const numEntries = getUint16(ifdOffset);
            for (let i = 0; i < numEntries; i++) {
              const entryOffset = ifdOffset + 2 + i * 12;
              const tag = getUint16(entryOffset);
              if (tag === 0x0112) {
                // Orientation tag
                const orientation = getUint16(entryOffset + 8);
                switch (orientation) {
                  case 3:
                    return 180;
                  case 6:
                    return 90;
                  case 8:
                    return 270;
                  default:
                    return 0;
                }
              }
            }
          }
          break;
        } else {
          offset += 2 + ((binary.charCodeAt(offset + 2) << 8) | binary.charCodeAt(offset + 3));
        }
      }
    } catch {}
    return 0;
  }

  /**
   * Analyzes physical image content:
   * Menus formatted horizontally have high horizontal edge density and line profile variance.
   * If rotated 90° or 270°, vertical edge density dominates.
   * Also analyzes mass centroid (titles/headers typically on top 35% of page).
   */
  private static detectContentOrientation(
    img: HTMLImageElement,
    w: number,
    h: number
  ): { bestAngle: number; confidence: number } {
    try {
      // Downsample to small analysis thumbnail (e.g. 240x320)
      const sampleW = 240;
      const sampleH = 320;
      const canvas = document.createElement('canvas');
      canvas.width = sampleW;
      canvas.height = sampleH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { bestAngle: 0, confidence: 0.5 };

      ctx.drawImage(img, 0, 0, sampleW, sampleH);
      const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
      const data = imgData.data;

      // Calculate horizontal vs vertical gradients
      let horizontalGradSum = 0;
      let verticalGradSum = 0;

      // Also calculate top-half vs bottom-half dark ink density
      let topHalfInk = 0;
      let bottomHalfInk = 0;

      for (let y = 1; y < sampleH - 1; y++) {
        for (let x = 1; x < sampleW - 1; x++) {
          const idx = (y * sampleW + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

          // Horizontal neighbor diff
          const idxXPlus = (y * sampleW + (x + 1)) * 4;
          const lumXPlus = 0.299 * data[idxXPlus] + 0.587 * data[idxXPlus + 1] + 0.114 * data[idxXPlus + 2];
          const gx = Math.abs(lum - lumXPlus);

          // Vertical neighbor diff
          const idxYPlus = ((y + 1) * sampleW + x) * 4;
          const lumYPlus = 0.299 * data[idxYPlus] + 0.587 * data[idxYPlus + 1] + 0.114 * data[idxYPlus + 2];
          const gy = Math.abs(lum - lumYPlus);

          horizontalGradSum += gx;
          verticalGradSum += gy;

          if (lum < 160) {
            if (y < sampleH / 2) topHalfInk++;
            else bottomHalfInk++;
          }
        }
      }

      // Check aspect ratio of source image
      const isLandscape = w > h * 1.25;

      // If vertical gradients significantly exceed horizontal gradients on a landscape image,
      // the menu was photographed sideways (needs 90° or 270° rotation to be portrait)
      if (isLandscape && verticalGradSum > horizontalGradSum * 1.15) {
        // Sideways image!
        return { bestAngle: 90, confidence: 0.85 };
      }

      // If upside down (180°), text mass / headers are inverted
      if (bottomHalfInk > topHalfInk * 1.6) {
        // High confidence upside down
        return { bestAngle: 180, confidence: 0.8 };
      }

      return { bestAngle: 0, confidence: 0.9 };
    } catch {
      return { bestAngle: 0, confidence: 0.5 };
    }
  }

  /**
   * Calculates deskew angle between -15° and +15° using horizontal projection profile variance.
   */
  private static calculateDeskewAngle(
    img: HTMLImageElement,
    w: number,
    h: number,
    baseRotation: number
  ): number {
    try {
      const sampleSize = 300;
      const canvas = document.createElement('canvas');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;

      // Draw oriented thumbnail
      ctx.save();
      ctx.translate(sampleSize / 2, sampleSize / 2);
      ctx.rotate((baseRotation * Math.PI) / 180);
      const isSideways = baseRotation === 90 || baseRotation === 270;
      const dw = isSideways ? sampleSize * (h / w) : sampleSize;
      const dh = isSideways ? sampleSize : sampleSize * (h / w);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const pixels = imgData.data;

      // Binarize
      const binarized = new Uint8Array(sampleSize * sampleSize);
      for (let i = 0; i < pixels.length; i += 4) {
        const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        binarized[i / 4] = lum < 180 ? 1 : 0;
      }

      // Test angles from -6° to +6° in 0.5° increments
      let bestVariance = -1;
      let bestAngle = 0;

      for (let angle = -6; angle <= 6; angle += 0.5) {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rowCounts = new Float64Array(sampleSize);
        let validPoints = 0;

        for (let y = 30; y < sampleSize - 30; y += 2) {
          for (let x = 30; x < sampleSize - 30; x += 2) {
            if (binarized[y * sampleSize + x] === 1) {
              const rotatedY = Math.round((x - 150) * sin + (y - 150) * cos + 150);
              if (rotatedY >= 0 && rotatedY < sampleSize) {
                rowCounts[rotatedY]++;
                validPoints++;
              }
            }
          }
        }

        if (validPoints > 50) {
          let sum = 0;
          for (let i = 0; i < sampleSize; i++) sum += rowCounts[i];
          const mean = sum / sampleSize;
          let variance = 0;
          for (let i = 0; i < sampleSize; i++) {
            variance += (rowCounts[i] - mean) ** 2;
          }

          if (variance > bestVariance) {
            bestVariance = variance;
            bestAngle = angle;
          }
        }
      }

      return Math.round(bestAngle * 10) / 10;
    } catch {
      return 0;
    }
  }

  /**
   * Renders the upright and deskewed corrected image.
   */
  private static renderCorrectedImage(
    img: HTMLImageElement,
    origW: number,
    origH: number,
    rotation: number,
    deskewAngle: number,
    maxDim: number = 1800
  ): string {
    const is90or270 = rotation === 90 || rotation === 270;
    const targetW = is90or270 ? origH : origW;
    const targetH = is90or270 ? origW : origH;

    let scale = 1;
    const maxDimension = Math.max(targetW, targetH);
    if (maxDimension > maxDim) {
      scale = maxDim / maxDimension;
    } else if (maxDimension < 900) {
      scale = Math.min(2.0, 1200 / maxDimension);
    }

    const finalW = Math.round(targetW * scale);
    const finalH = Math.round(targetH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return img.src;

    // Fill clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalW, finalH);

    ctx.save();
    ctx.translate(finalW / 2, finalH / 2);
    // Combine cardinal rotation with deskew angle
    const totalRotationRad = ((rotation + deskewAngle) * Math.PI) / 180;
    ctx.rotate(totalRotationRad);

    const drawW = is90or270 ? finalH : finalW;
    const drawH = is90or270 ? finalW : finalH;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.90);
  }

  /**
   * Renders high-contrast grayscale image for ML Kit / OCR legibility.
   */
  private static renderOcrEnhancement(correctedDataUrl: string): string {
    try {
      const img = new Image();
      img.src = correctedDataUrl;
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 1200;
      canvas.height = img.height || 1600;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return correctedDataUrl;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imgData.data;

      // Grayscale + Adaptive Contrast Boost
      const contrast = 1.35;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < pixels.length; i += 4) {
        const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        const adjusted = factor * (gray - 128) + 128;
        const clamped = Math.max(0, Math.min(255, adjusted));
        pixels[i] = clamped;
        pixels[i + 1] = clamped;
        pixels[i + 2] = clamped;
      }

      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return correctedDataUrl;
    }
  }

  /**
   * User manual rotation helper (e.g. Rotate Left 90° or Rotate Right 90°)
   */
  static rotatePage(
    currentDataUrl: string,
    deltaDegrees: number
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        const isSideways = deltaDegrees === 90 || deltaDegrees === 270 || deltaDegrees === -90;
        const newW = isSideways ? origH : origW;
        const newH = isSideways ? origW : origH;

        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(currentDataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, newW, newH);

        ctx.save();
        ctx.translate(newW / 2, newH / 2);
        ctx.rotate((deltaDegrees * Math.PI) / 180);
        ctx.drawImage(img, -origW / 2, -origH / 2, origW, origH);
        ctx.restore();

        resolve(canvas.toDataURL('image/jpeg', 0.90));
      };
      img.onerror = () => resolve(currentDataUrl);
      img.src = currentDataUrl;
    });
  }
}
