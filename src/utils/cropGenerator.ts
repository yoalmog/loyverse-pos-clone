import { BoundingBox } from '../types/menuScanner.ts';

/**
 * Extracts a high-resolution sub-image crop from a base64 menu page image
 * using normalized bounding box coordinates (0.0 - 1.0) with optional margin.
 */
export async function getCropFromBoundingBox(
  imageSource: string,
  box: BoundingBox,
  marginPercent: number = 0.03
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!imageSource || !box) {
      return reject(new Error('Missing image or bounding box coordinates'));
    }

    const img = new Image();
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;

        if (naturalW === 0 || naturalH === 0) {
          return resolve(imageSource);
        }

        // Apply margins in normalized space
        const leftNorm = Math.max(0, box.left - marginPercent);
        const topNorm = Math.max(0, box.top - marginPercent);
        const rightNorm = Math.min(1, box.right + marginPercent);
        const bottomNorm = Math.min(1, box.bottom + marginPercent);

        const cropX = Math.round(leftNorm * naturalW);
        const cropY = Math.round(topNorm * naturalH);
        const cropW = Math.max(10, Math.round((rightNorm - leftNorm) * naturalW));
        const cropH = Math.max(10, Math.round((bottomNorm - topNorm) * naturalH));

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(imageSource);
        }

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        console.warn('Crop generation error:', e);
        resolve(imageSource);
      }
    };

    img.onerror = () => {
      resolve(imageSource);
    };

    img.src = imageSource;
  });
}
