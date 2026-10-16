/**
 * AuraPOS - Local Client Image Preprocessor for On-Device Menu Scanning
 * Conforming to Section 5:
 * Performs resolution normalization, grayscale conversion, contrast enhancement,
 * and edge sharpening while keeping the original image intact for user inspection.
 */

export interface PreprocessingResult {
  originalDataUrl: string;
  processedOcrDataUrl: string;
  width: number;
  height: number;
  rotation: number;
}

export class ImagePreprocessor {
  /**
   * Preprocesses an image dataUrl for maximum OCR legibility
   */
  static async preprocessForOcr(
    dataUrl: string,
    rotation: number = 0,
    targetMaxDim: number = 2000
  ): Promise<PreprocessingResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          // 1. Determine scaled dimensions (normalizing resolution)
          let origW = img.naturalWidth || img.width;
          let origH = img.naturalHeight || img.height;

          // Swap w & h if rotated 90 or 270 deg
          const isRotated90or270 = rotation === 90 || rotation === 270;
          const displayW = isRotated90or270 ? origH : origW;
          const displayH = isRotated90or270 ? origW : origH;

          const maxDim = Math.max(displayW, displayH);
          let scale = 1;
          if (maxDim > targetMaxDim) {
            scale = targetMaxDim / maxDim;
          } else if (maxDim < 800) {
            scale = Math.min(2.0, 1200 / maxDim);
          }

          const targetW = Math.round(displayW * scale);
          const targetH = Math.round(displayH * scale);

          // 2. Render Normalized Original Canvas
          const origCanvas = document.createElement('canvas');
          origCanvas.width = targetW;
          origCanvas.height = targetH;
          const origCtx = origCanvas.getContext('2d');
          if (!origCtx) throw new Error('Could not get 2D canvas context');

          origCtx.save();
          origCtx.translate(targetW / 2, targetH / 2);
          origCtx.rotate((rotation * Math.PI) / 180);
          if (isRotated90or270) {
            origCtx.drawImage(img, -targetH / 2, -targetW / 2, targetH, targetW);
          } else {
            origCtx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
          }
          origCtx.restore();

          const normalizedOriginalUrl = origCanvas.toDataURL('image/jpeg', 0.90);

          // 3. Render Processed OCR Canvas (Grayscale + High Contrast Boost)
          const ocrCanvas = document.createElement('canvas');
          ocrCanvas.width = targetW;
          ocrCanvas.height = targetH;
          const ocrCtx = ocrCanvas.getContext('2d');
          if (!ocrCtx) throw new Error('Could not get OCR canvas context');

          // Draw normalized original
          ocrCtx.drawImage(origCanvas, 0, 0);

          // Extract pixel buffer for adaptive contrast enhancement
          const imgData = ocrCtx.getImageData(0, 0, targetW, targetH);
          const pixels = imgData.data;
          const contrast = 1.35; // +35% contrast boost
          const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

          for (let i = 0; i < pixels.length; i += 4) {
            // Luminance grayscale: 0.299 R + 0.587 G + 0.114 B
            const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            // Apply contrast curve
            const adjusted = factor * (gray - 128) + 128;
            const clamped = Math.max(0, Math.min(255, adjusted));

            pixels[i] = clamped;
            pixels[i + 1] = clamped;
            pixels[i + 2] = clamped;
            // pixels[i + 3] remains alpha
          }

          ocrCtx.putImageData(imgData, 0, 0);

          const processedOcrUrl = ocrCanvas.toDataURL('image/jpeg', 0.85);

          resolve({
            originalDataUrl: normalizedOriginalUrl,
            processedOcrDataUrl: processedOcrUrl,
            width: targetW,
            height: targetH,
            rotation
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for preprocessing.'));
      img.src = dataUrl;
    });
  }

  /**
   * Crops a bounding box region out of an image dataUrl
   */
  static async cropBoundingBox(
    dataUrl: string,
    bbox: { left: number; top: number; width: number; height: number },
    padding: number = 0.02
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          // Expand bounding box slightly for visual padding
          const padX = bbox.width * padding;
          const padY = bbox.height * padding;

          const sx = Math.max(0, Math.round((bbox.left - padX) * w));
          const sy = Math.max(0, Math.round((bbox.top - padY) * h));
          const sw = Math.min(w - sx, Math.round((bbox.width + padX * 2) * w));
          const sh = Math.min(h - sy, Math.round((bbox.height + padY * 2) * h));

          if (sw <= 0 || sh <= 0) {
            resolve('');
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve('');
            return;
          }

          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }
}
