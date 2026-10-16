/**
 * AuraPOS - ESC/POS QR Code & Bitmap Image Rasterizer
 * Conforming to Sections 10, 11, 12, 13, 28:
 * - Converts real uploaded PNG/JPEG/WEBP QR codes into crisp 1-bit monochrome ESC/POS raster bitmaps
 * - Preserves aspect ratio, clean white quiet-zone padding, high scan contrast
 * - Supports 58mm (384 dots) and 80mm (576 dots) printer widths
 */

export interface RasterizedImage {
  width: number;
  height: number;
  bytesPerRow: number;
  data: Uint8Array;
}

export class QrImageRasterizer {
  /**
   * Convert an image Data URL to a 1-bit monochrome ESC/POS raster bitmap
   */
  static async rasterizeImage(
    dataUrl: string,
    targetWidthPx: number = 240, // small: 160, medium: 240, large: 320
    maxWidthPx: number = 384 // 58mm: 384, 80mm: 576
  ): Promise<RasterizedImage | null> {
    if (!dataUrl || typeof window === 'undefined') return null;

    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          // Clamp target size
          const safeTargetWidth = Math.min(targetWidthPx, maxWidthPx - 32);
          const aspectRatio = img.height / img.width;
          const targetHeightPx = Math.round(safeTargetWidth * aspectRatio);

          // Force width to multiple of 8 for byte-aligned ESC/POS raster
          const alignedWidth = Math.ceil(safeTargetWidth / 8) * 8;
          const alignedHeight = targetHeightPx;

          const canvas = document.createElement('canvas');
          canvas.width = alignedWidth;
          canvas.height = alignedHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          // Fill white quiet-zone background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, alignedWidth, alignedHeight);

          // Draw image centered with white margin
          const padding = 8;
          ctx.drawImage(
            img,
            padding,
            padding,
            alignedWidth - padding * 2,
            alignedHeight - padding * 2
          );

          const imgData = ctx.getImageData(0, 0, alignedWidth, alignedHeight);
          const pixels = imgData.data;

          const bytesPerRow = alignedWidth / 8;
          const totalBytes = bytesPerRow * alignedHeight;
          const rasterData = new Uint8Array(totalBytes);

          // Thresholding to 1-bit monochrome (MSB first for GS v 0)
          for (let y = 0; y < alignedHeight; y++) {
            for (let x = 0; x < alignedWidth; x++) {
              const pixelIdx = (y * alignedWidth + x) * 4;
              const r = pixels[pixelIdx];
              const g = pixels[pixelIdx + 1];
              const b = pixels[pixelIdx + 2];
              const a = pixels[pixelIdx + 3];

              // Luminance formula
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
              const isBlack = a > 128 && luminance < 165; // Black dot

              if (isBlack) {
                const byteIdx = y * bytesPerRow + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8);
                rasterData[byteIdx] |= (1 << bitIdx);
              }
            }
          }

          resolve({
            width: alignedWidth,
            height: alignedHeight,
            bytesPerRow,
            data: rasterData
          });
        } catch (e) {
          console.error('Failed to rasterize QR image:', e);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error('Failed to load QR image for rasterization');
        resolve(null);
      };

      img.src = dataUrl;
    });
  }

  /**
   * Validate a QR image file (format, dimensions, decode test)
   */
  static async validateQrImage(file: File): Promise<{
    valid: boolean;
    dataUrl?: string;
    width?: number;
    height?: number;
    warning?: string;
    error?: string;
  }> {
    return new Promise(resolve => {
      if (!file.type.startsWith('image/')) {
        resolve({
          valid: false,
          error: 'Please upload a valid image file (PNG, JPG, or WEBP).'
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          resolve({ valid: false, error: 'Could not read image data.' });
          return;
        }

        const dataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (width < 100 || height < 100) {
            resolve({
              valid: true,
              dataUrl,
              width,
              height,
              warning: 'Image resolution is very low. A clearer, higher-resolution QR photo is recommended for thermal printing.'
            });
            return;
          }

          resolve({
            valid: true,
            dataUrl,
            width,
            height
          });
        };

        img.onerror = () => {
          resolve({ valid: false, error: 'The selected image could not be decoded.' });
        };

        img.src = dataUrl;
      };

      reader.onerror = () => {
        resolve({ valid: false, error: 'Error reading file from disk.' });
      };

      reader.readAsDataURL(file);
    });
  }
}
