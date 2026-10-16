import { useEffect, useRef } from 'react';

export interface UseHardwareBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  maxIntervalMs?: number; // Maximum ms between characters from hardware scanner (standard is < 50ms)
  minBarcodeLength?: number;
}

/**
 * Hook to capture hardware barcode scanner input across physical USB,
 * Bluetooth, and 2.4G wireless HID barcode scanners.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxIntervalMs = 60,
  minBarcodeLength = 3
}: UseHardwareBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Handle Enter (Scanner delimiter / suffix)
      if (event.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= minBarcodeLength) {
          event.preventDefault();
          event.stopPropagation();
          onScan(barcode);
        }
        return;
      }

      // If user took too long between characters, reset buffer
      if (timeDiff > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only accumulate printable single characters
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // If focused in an input/textarea and the typing pace is human (> 70ms), ignore
        const activeElement = document.activeElement;
        const isInputActive =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            (activeElement as HTMLElement).isContentEditable);

        // If in an input, only accumulate if stream is arriving at scanner speeds (< 45ms)
        if (isInputActive && bufferRef.current.length === 0 && timeDiff > 45) {
          return;
        }

        bufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minBarcodeLength, onScan]);
}
