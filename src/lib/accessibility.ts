/**
 * Loyverse POS Accessibility Engine (Section 508 / WCAG 2.1 AA Compliant)
 * Features:
 *  - Text Scaling: 1.0x, 1.15x, 1.30x, 1.50x
 *  - Contrast Modes: Normal, High Contrast, Extra-High Contrast
 *  - Colorblind Daltonization filters: Protanopia, Deuteranopia, Tritanopia, Monochrome
 *  - Touch Target Sizing: Normal (44px), Large (52px), Extra Large (60px)
 *  - Web Audio Synthesizer: Click, Barcode Beep, Checkout Chime, Error Buzz
 *  - Haptic Vibration: tactile feedback via navigator.vibrate
 *  - Live Screen Reader Announcer: aria-live polite announcer
 */

export type TextScaleLevel = '1.0' | '1.15' | '1.30' | '1.50';
export type ContrastMode = 'normal' | 'high' | 'extra-high';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';
export type TouchTargetSize = 'normal' | 'large' | 'xlarge';

export interface AccessibilitySettings {
  textScale: TextScaleLevel;
  contrast: ContrastMode;
  colorblind: ColorblindMode;
  touchTarget: TouchTargetSize;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_A11Y_SETTINGS: AccessibilitySettings = {
  textScale: '1.0',
  contrast: 'normal',
  colorblind: 'none',
  touchTarget: 'normal',
  soundEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
};

// Web Audio API Sound Synthesizer
class SoundFeedbackService {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playClick() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  playBarcodeBeep() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // High sharp A6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  playCheckoutChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.26);
      });
    } catch {}
  }

  playErrorBuzz() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.21);
    } catch {}
  }
}

export const soundFeedback = new SoundFeedbackService();

// Haptic feedback utility
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'success':
        navigator.vibrate([20, 40, 30]);
        break;
      case 'warning':
        navigator.vibrate([60, 50, 60]);
        break;
    }
  } catch {}
}

// Live screen reader announcer utility
export class AccessibilityLiveAnnouncer {
  private static liveElementId = 'pos-live-announcer';

  static announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(this.liveElementId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.liveElementId;
      el.setAttribute('aria-live', priority);
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      el.style.position = 'absolute';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.padding = '0';
      el.style.margin = '-1px';
      el.style.overflow = 'hidden';
      el.style.clip = 'rect(0, 0, 0, 0)';
      el.style.border = '0';
      document.body.appendChild(el);
    }
    el.textContent = '';
    setTimeout(() => {
      if (el) el.textContent = message;
    }, 50);
  }
}

// Colorblind Daltonization Filter CSS Generators
export function getColorblindFilterStyle(mode: ColorblindMode): React.CSSProperties {
  switch (mode) {
    case 'protanopia':
      return { filter: 'url("#protanopia-filter")' };
    case 'deuteranopia':
      return { filter: 'url("#deuteranopia-filter")' };
    case 'tritanopia':
      return { filter: 'url("#tritanopia-filter")' };
    case 'monochrome':
      return { filter: 'grayscale(100%) contrast(110%)' };
    default:
      return {};
  }
}

