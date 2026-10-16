/**
 * AuraPOS - Image Optimization for AI OCR & Menu Scanning
 * 
 * Compresses and scales high-resolution smartphone menu photos (often 15-30MB each)
 * down to optimal OCR resolution (max 1500px, JPEG quality 0.82, ~200-350KB per page)
 * and bakes in any user rotation so Gemini sees crisp, upright text.
 * Prevents HTTP payload size limits (Cloud Run 32MB limit) and "Failed to fetch" errors.
 */

export interface ValidatedMenuPageImage {
  dataUrl: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  isValid: boolean;
  validationError?: string;
}

export function validateMenuPageImage(
  dataUrl: string,
  mimeType: string = 'image/jpeg'
): { isValid: boolean; error?: string } {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.trim().length === 0) {
    return { isValid: false, error: 'Empty image data.' };
  }

  // Check base64 format
  if (!dataUrl.startsWith('data:image/') && !dataUrl.startsWith('/')) {
    // Might be raw base64 or URL
    if (dataUrl.length < 50) {
      return { isValid: false, error: 'Malformed or truncated image data.' };
    }
  }

  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const effectiveMime = (mimeType || 'image/jpeg').toLowerCase();
  if (!supportedTypes.includes(effectiveMime)) {
    return {
      isValid: false,
      error: `Unsupported image format (${mimeType}). Please use JPG, PNG, or WebP.`
    };
  }

  // Check approximate payload size (max 25MB single image before compression)
  const approxSize = Math.round((dataUrl.length * 3) / 4);
  if (approxSize > 25 * 1024 * 1024) {
    return {
      isValid: false,
      error: 'Individual image exceeds 25MB. Please choose a smaller photo.'
    };
  }

  return { isValid: true };
}

export async function optimizeImageForOCR(
  dataUrlOrBlob: string | Blob,
  rotationDegrees: number = 0,
  maxDimension: number = 1500,
  quality: number = 0.82
): Promise<{ dataUrl: string; fileSize: number; width: number; height: number }> {
  return new Promise((resolve) => {
    let srcUrl = '';
    let isObjectUrl = false;

    if (typeof dataUrlOrBlob === 'string') {
      srcUrl = dataUrlOrBlob;
    } else {
      srcUrl = URL.createObjectURL(dataUrlOrBlob);
      isObjectUrl = true;
    }

    const img = new Image();
    
    // Only set crossOrigin for remote HTTP/HTTPS URLs.
    // Setting crossOrigin on data: or blob: URLs causes CORS errors in Chromium/Android WebViews!
    if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    let isDone = false;
    const cleanup = () => {
      if (isObjectUrl) {
        try {
          URL.revokeObjectURL(srcUrl);
        } catch {}
      }
    };

    // Safety timeout: 10s max for canvas compression
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        cleanup();
        const str = typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
        resolve({
          dataUrl: str,
          fileSize: Math.round((str.length * 3) / 4),
          width: 800,
          height: 600
        });
      }
    }, 10000);

    img.onload = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      cleanup();

      const origWidth = img.naturalWidth || img.width;
      const origHeight = img.naturalHeight || img.height;

      if (!origWidth || !origHeight) {
        const str = typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
        resolve({
          dataUrl: str,
          fileSize: Math.round((str.length * 3) / 4),
          width: 800,
          height: 600
        });
        return;
      }

      // Calculate scaled dimensions to stay within maxDimension while maintaining aspect ratio
      let targetWidth = origWidth;
      let targetHeight = origHeight;

      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
          targetWidth = maxDimension;
        } else {
          targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
          targetHeight = maxDimension;
        }
      }

      // Create off-screen canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        const str = typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
        resolve({
          dataUrl: str,
          fileSize: Math.round((str.length * 3) / 4),
          width: targetWidth,
          height: targetHeight
        });
        return;
      }

      const normRotation = ((rotationDegrees % 360) + 360) % 360;

      // Adjust canvas size based on rotation
      if (normRotation === 90 || normRotation === 270) {
        canvas.width = targetHeight;
        canvas.height = targetWidth;
      } else {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      // Fill crisp white background for high OCR contrast
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply rotation transformation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normRotation * Math.PI) / 180);
      ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
      ctx.restore();

      try {
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const estSize = Math.round((optimizedDataUrl.length * 3) / 4);

        resolve({
          dataUrl: optimizedDataUrl,
          fileSize: estSize,
          width: canvas.width,
          height: canvas.height
        });
      } catch (e) {
        const str = typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
        resolve({
          dataUrl: str,
          fileSize: Math.round((str.length * 3) / 4),
          width: targetWidth,
          height: targetHeight
        });
      }
    };

    img.onerror = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      cleanup();
      const str = typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
      resolve({
        dataUrl: str,
        fileSize: Math.round((str.length * 3) / 4),
        width: 800,
        height: 600
      });
    };

    img.src = srcUrl;
  });
}

export async function optimizeFileList(
  files: File[]
): Promise<Array<{ id: string; name: string; dataUrl: string; fileSize: number; mimeType: string }>> {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const optimized = await optimizeImageForOCR(file, 0, 1500, 0.82);
      results.push({
        id: `page_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        name: file.name || `Page ${i + 1}`,
        dataUrl: optimized.dataUrl,
        fileSize: optimized.fileSize,
        mimeType: 'image/jpeg'
      });
    } catch {
      // Fallback
    }
  }
  return results;
}
