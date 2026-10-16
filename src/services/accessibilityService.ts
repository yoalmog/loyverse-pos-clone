/**
 * AuraPOS - Production-Grade Centralized Accessibility Service
 * 
 * Manages:
 * 1. Persistent accessibility settings across sessions and hardware reboots.
 * 2. Real-time DOM attribute and CSS variable dynamic scaling injection.
 * 3. Haptic feedback (light, medium, heavy, success, warning, error) via Native Android & Web Vibration API.
 * 4. Audio feedback synthesizer via Web Audio API (subtle, non-fatiguing POS audio cues).
 * 5. Screen reader live regions & Android TalkBack native speech announcements.
 */

import {
  AccessibilitySettings,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  TextScale,
  TouchTargetSize
} from '../types/pos.ts';
import { NativeBridgeService } from './native/NativeBridgeService.ts';

const STORAGE_KEY = 'aurapos_accessibility_settings_v2';

export class AccessibilityService {
  private static cachedSettings: AccessibilitySettings | null = null;
  private static audioContext: AudioContext | null = null;

  /**
   * Retrieve current stored accessibility settings.
   */
  static getSettings(): AccessibilitySettings {
    if (this.cachedSettings) return this.cachedSettings;

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.cachedSettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS, ...parsed };
          return this.cachedSettings!;
        }
      } catch (e) {
        console.warn('Failed to read accessibility settings from localStorage:', e);
      }
    }

    this.cachedSettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
    return this.cachedSettings;
  }

  /**
   * Update and persist accessibility preferences.
   */
  static saveSettings(partial: Partial<AccessibilitySettings>): AccessibilitySettings {
    const current = this.getSettings();
    const updated: AccessibilitySettings = { ...current, ...partial };
    this.cachedSettings = updated;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist accessibility settings:', e);
      }
    }

    this.applyToDOM(updated);
    return updated;
  }

  /**
   * Reset accessibility preferences to default.
   */
  static resetToDefault(): AccessibilitySettings {
    this.cachedSettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cachedSettings));
      } catch {}
    }
    this.applyToDOM(this.cachedSettings);
    return this.cachedSettings;
  }

  /**
   * Applies all accessibility tokens, semantic data attributes, and CSS variables
   * to the root HTML document element.
   */
  static applyToDOM(settings: AccessibilitySettings): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Text scaling factor
    const scaleFactorMap: Record<TextScale, number> = {
      normal: 1.0,
      large: 1.15,
      xlarge: 1.30,
      maximum: 1.50
    };
    const scaleFactor = scaleFactorMap[settings.textScale] || 1.0;

    // Touch target minimum size
    const touchSizeMap: Record<TouchTargetSize, number> = {
      normal: 44,
      large: 52,
      xlarge: 60
    };
    const touchSize = touchSizeMap[settings.touchTargetSize] || 44;

    // Set Data Attributes on <html>
    root.setAttribute('data-text-scale', settings.textScale);
    root.setAttribute('data-contrast', settings.contrastMode);
    root.setAttribute('data-bold-text', String(settings.boldText));
    root.setAttribute('data-reduce-motion', String(settings.reduceMotion));
    root.setAttribute('data-disable-animations', String(settings.disableAnimations));
    root.setAttribute('data-touch-targets', settings.touchTargetSize);
    root.setAttribute('data-extra-spacing', String(settings.extraSpacing));
    root.setAttribute('data-simplified-pos', String(settings.simplifiedPos));
    root.setAttribute('data-screen-reader', String(settings.screenReaderOptimization));
    root.setAttribute('data-colorblind', settings.colorBlindMode);
    root.setAttribute('data-focus-indicators', String(settings.focusIndicators));
    root.setAttribute('data-reduce-transparency', String(settings.reduceTransparency));

    // CSS Custom Properties for proportional dynamic layout scaling
    root.style.setProperty('--a11y-text-scale', String(scaleFactor));
    root.style.setProperty('--a11y-min-touch', `${touchSize}px`);
    root.style.setProperty('--a11y-focus-ring-width', settings.contrastMode !== 'normal' ? '4px' : '3px');
    root.style.setProperty(
      '--a11y-focus-ring-color',
      settings.contrastMode === 'extra-high' ? '#f59e0b' : settings.contrastMode === 'high' ? '#000000' : '#2563eb'
    );
  }

  // --------------------------------------------------------------------------
  // Haptic Feedback (Section 11)
  // --------------------------------------------------------------------------

  static triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
    const settings = this.getSettings();
    if (!settings.hapticFeedback) return;

    switch (type) {
      case 'light':
        NativeBridgeService.accessibility.vibrate(25);
        break;
      case 'medium':
        NativeBridgeService.accessibility.vibrate(50);
        break;
      case 'heavy':
        NativeBridgeService.accessibility.vibrate(90);
        break;
      case 'success':
        // Double pulse for confirmation
        NativeBridgeService.accessibility.vibrate(30);
        setTimeout(() => NativeBridgeService.accessibility.vibrate(50), 70);
        break;
      case 'warning':
        NativeBridgeService.accessibility.vibrate(70);
        break;
      case 'error':
        NativeBridgeService.accessibility.vibrate(120);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Audio Feedback Synthesizer (Section 11)
  // --------------------------------------------------------------------------

  private static getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  static playAudioCue(type: 'click' | 'add' | 'remove' | 'pay' | 'success' | 'error' | 'beep' = 'click'): void {
    const settings = this.getSettings();
    if (!settings.audioFeedback) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (type) {
        case 'click':
          // Subtle 750Hz tap
          osc.type = 'sine';
          osc.frequency.setValueAtTime(750, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          osc.start(now);
          osc.stop(now + 0.035);
          break;

        case 'add':
          // Ascending two-tone chime (520Hz -> 680Hz)
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.11);
          break;

        case 'remove':
          // Descending chime (680Hz -> 480Hz)
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(680, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.11);
          break;

        case 'pay':
        case 'success': {
          // Harmonious major chord
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
          osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.36);
          break;
        }

        case 'error':
          // Low warning buzz (220Hz saw)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.19);
          break;

        case 'beep':
          // Standard 1000Hz scanner beep
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1000, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
      }
    } catch (e) {
      console.warn('Audio cue failed:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Screen Reader & Live Spoken Announcements (Section 6 & 11)
  // --------------------------------------------------------------------------

  static announce(text: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!text || typeof document === 'undefined') return;

    // 1. Dispatch to HTML5 ARIA live region
    const targetId = priority === 'assertive' ? 'a11y-live-assertive' : 'a11y-live-polite';
    const liveRegion = document.getElementById(targetId);
    if (liveRegion) {
      // Clear and re-populate to ensure screen readers re-trigger on identical announcements
      liveRegion.textContent = '';
      setTimeout(() => {
        liveRegion.textContent = text;
      }, 50);
    }

    // 2. Dispatch to Android Native TalkBack bridge
    NativeBridgeService.accessibility.announce(text);

    // 3. Optional Spoken Feedback via Web SpeechSynthesis API if user enabled spoken feedback
    const settings = this.getSettings();
    if (settings.spokenFeedback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis announcement error:', e);
      }
    }
  }
}
