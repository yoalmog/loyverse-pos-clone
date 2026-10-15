'use client';

import React from 'react';
import { X, Volume2, VolumeX, Eye, Sparkles, Languages, Sliders } from 'lucide-react';
import { LANGUAGES, LanguageCode, DICTIONARY } from '@/lib/i18n';
import { THEME_PALETTES, BackgroundPattern, ThemePalette } from '@/lib/theming';
import { 
  AccessibilitySettings, 
  TextScaleLevel, 
  ContrastMode, 
  ColorblindMode, 
  TouchTargetSize, 
  soundFeedback, 
  triggerHaptic 
} from '@/lib/accessibility';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  currentPalette: string;
  onSelectPalette: (paletteId: string) => void;
  currentPattern: BackgroundPattern;
  onSelectPattern: (pattern: BackgroundPattern) => void;
  a11y: AccessibilitySettings;
  onUpdateA11y: (updater: (prev: AccessibilitySettings) => AccessibilitySettings) => void;
}

export function AccessibilityModal({
  isOpen,
  onClose,
  currentLang,
  onSelectLang,
  currentPalette,
  onSelectPalette,
  currentPattern,
  onSelectPattern,
  a11y,
  onUpdateA11y,
}: AccessibilityModalProps) {
  if (!isOpen) return null;

  const t = DICTIONARY[currentLang] || DICTIONARY.es;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {t.accessibility} & {t.theme}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* 1. Language Selection */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Languages className="h-4 w-4 text-emerald-400" />
              {t.language} (9 Languages & RTL Support)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onSelectLang(lang.code);
                    soundFeedback.playClick();
                    triggerHaptic('light');
                  }}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-medium transition-all ${
                    currentLang === lang.code
                      ? 'border-emerald-500 bg-emerald-500/10 text-white font-bold'
                      : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <div>
                    <div className="leading-tight">{lang.nativeName}</div>
                    <div className="text-[10px] text-slate-500">{lang.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Theme Palette */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              {t.theme}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {THEME_PALETTES.map((pal) => (
                <button
                  key={pal.id}
                  onClick={() => {
                    onSelectPalette(pal.id);
                    soundFeedback.playClick();
                    triggerHaptic('light');
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center text-xs transition-all ${
                    currentPalette === pal.id
                      ? 'border-emerald-500 bg-slate-800 ring-2 ring-emerald-500/40 text-white font-bold'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: pal.primaryHex }}
                  />
                  <span className="text-[11px] truncate w-full">{pal.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Text Scaling & Contrast */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tamaño de Texto (Text Scale)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['1.0', '1.15', '1.30', '1.50'] as TextScaleLevel[]).map((scale) => (
                  <button
                    key={scale}
                    onClick={() => {
                      onUpdateA11y((prev) => ({ ...prev, textScale: scale }));
                      soundFeedback.playClick();
                    }}
                    className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                      a11y.textScale === scale
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-800 bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Contraste (Contrast)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'high', 'extra-high'] as ContrastMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onUpdateA11y((prev) => ({ ...prev, contrast: mode }));
                      soundFeedback.playClick();
                    }}
                    className={`rounded-lg border py-2 text-xs font-semibold capitalize transition-all ${
                      a11y.contrast === mode
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode === 'normal' ? 'Normal' : mode === 'high' ? 'Alto' : 'Ultra'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Colorblind Filters & Touch Targets */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                Filtro Daltonismo (Colorblind)
              </label>
              <select
                value={a11y.colorblind}
                onChange={(e) => {
                  onUpdateA11y((prev) => ({ ...prev, colorblind: e.target.value as ColorblindMode }));
                  soundFeedback.playClick();
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="none">Ninguno (Estándar)</option>
                <option value="protanopia">Protanopía (Rojo débil)</option>
                <option value="deuteranopia">Deuteranopía (Verde débil)</option>
                <option value="tritanopia">Tritanopía (Azul/Amarillo)</option>
                <option value="monochrome">Monocromo / Escala de grises</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Área Táctil (Touch Target)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'large', 'xlarge'] as TouchTargetSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      onUpdateA11y((prev) => ({ ...prev, touchTarget: size }));
                      soundFeedback.playClick();
                    }}
                    className={`rounded-lg border py-2 text-xs font-semibold transition-all ${
                      a11y.touchTarget === size
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {size === 'normal' ? '44px' : size === 'large' ? '52px' : '60px'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Sound & Haptics Toggles */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="flex items-center gap-3">
              {a11y.soundEnabled ? (
                <Volume2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <VolumeX className="h-5 w-5 text-slate-500" />
              )}
              <div>
                <div className="text-xs font-bold text-white">Efectos de Sonido y Háptica</div>
                <div className="text-[11px] text-slate-400">
                  Sonidos de clic, escaneo de código y vibración táctil
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onUpdateA11y((prev) => {
                  const next = !prev.soundEnabled;
                  if (next) soundFeedback.playCheckoutChime();
                  return { ...prev, soundEnabled: next, hapticsEnabled: next };
                });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                a11y.soundEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  a11y.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 p-4">
          <button
            onClick={() => {
              onClose();
              soundFeedback.playClick();
            }}
            className="rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
