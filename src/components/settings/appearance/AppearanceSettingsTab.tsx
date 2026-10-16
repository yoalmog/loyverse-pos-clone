import React, { useState, useMemo } from 'react';
import { usePOS } from '../../../context/POSContext.tsx';
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Grid,
  CircleDot,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Sliders,
  Eye,
  Info,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import {
  AppearanceSettings,
  BackgroundStyle,
  CustomThemeColors,
  PatternStyle,
  ThemeMode,
  ThemePaletteId
} from '../../../types/pos.ts';
import {
  THEME_PALETTES,
  ThemeService,
  validateContrast
} from '../../../services/themeService.ts';

export const AppearanceSettingsTab: React.FC = () => {
  const {
    appearance,
    updateAppearance,
    resetAppearance,
    accessibility,
    showToast,
    announceAccessibility,
    triggerHaptic,
    playAudioCue,
    t
  } = usePOS();

  // Local draft state for live preview before saving (Requirement 11)
  const [draft, setDraft] = useState<AppearanceSettings>({ ...appearance });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Custom color draft inputs
  const [customColors, setCustomColors] = useState<CustomThemeColors>({
    primary: draft.customColors?.primary || '#0284c7',
    secondary: draft.customColors?.secondary || '#0ea5e9',
    accent: draft.customColors?.accent || '#38bdf8',
    bgTint: draft.customColors?.bgTint || '#f3f8fc'
  });

  // Calculate live preview tokens
  const previewTokens = useMemo(() => {
    return ThemeService.getTokens(draft);
  }, [draft]);

  // Contrast validation for custom theme (Requirement 10)
  const contrastCheck = useMemo(() => {
    return validateContrast(previewTokens.buttonText, previewTokens.button);
  }, [previewTokens]);

  const textContrastCheck = useMemo(() => {
    return validateContrast(previewTokens.textPrimary, previewTokens.background);
  }, [previewTokens]);

  // Handlers for updating draft
  const handleModeChange = (mode: ThemeMode) => {
    const updated: AppearanceSettings = { ...draft, mode };
    setDraft(updated);
    setHasUnsavedChanges(true);
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Preview theme mode: ${mode}`);
  };

  const handlePaletteChange = (palette: ThemePaletteId) => {
    const updated: AppearanceSettings = {
      ...draft,
      palette,
      customColors: palette === 'custom' ? customColors : draft.customColors
    };
    setDraft(updated);
    setHasUnsavedChanges(true);
    triggerHaptic('light');
    playAudioCue('click');
    const pName = THEME_PALETTES[palette]?.name || palette;
    announceAccessibility(`${pName} palette selected for preview`);
  };

  const handleBgStyleChange = (backgroundStyle: BackgroundStyle) => {
    const updated: AppearanceSettings = { ...draft, backgroundStyle };
    setDraft(updated);
    setHasUnsavedChanges(true);
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Background style: ${backgroundStyle}`);
  };

  const handlePatternChange = (pattern: PatternStyle) => {
    const updated: AppearanceSettings = { ...draft, pattern };
    setDraft(updated);
    setHasUnsavedChanges(true);
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Background pattern: ${pattern}`);
  };

  const handleCustomColorChange = (field: keyof CustomThemeColors, value: string) => {
    const updatedCustom = { ...customColors, [field]: value };
    setCustomColors(updatedCustom);
    const updated: AppearanceSettings = {
      ...draft,
      palette: 'custom',
      customColors: updatedCustom
    };
    setDraft(updated);
    setHasUnsavedChanges(true);
  };

  // Auto-tune custom color to pass WCAG AA
  const handleAutoAdjustContrast = () => {
    if (contrastCheck.recommendedColor) {
      handleCustomColorChange('primary', contrastCheck.recommendedColor);
      triggerHaptic('success');
      playAudioCue('success');
      showToast({
        type: 'success',
        title: 'Contrast Optimized',
        message: 'Primary color adjusted to ensure high accessibility contrast.'
      });
    }
  };

  // Save changes to store
  const handleApplyTheme = () => {
    updateAppearance(draft);
    setHasUnsavedChanges(false);
    triggerHaptic('success');
    playAudioCue('success');
    showToast({
      type: 'success',
      title: t('appearance.appliedTitle', 'Theme Applied'),
      message: t('appearance.appliedMsg', 'New appearance and color palette applied globally across AuraPOS.')
    });
    announceAccessibility('Theme applied globally');
  };

  // Cancel preview and revert to current saved
  const handleCancelPreview = () => {
    setDraft({ ...appearance });
    setHasUnsavedChanges(false);
    triggerHaptic('medium');
    playAudioCue('remove');
    showToast({
      type: 'info',
      title: t('appearance.revertedTitle', 'Changes Cancelled'),
      message: t('appearance.revertedMsg', 'Reverted preview back to currently active theme.')
    });
    announceAccessibility('Theme changes discarded');
  };

  // Reset to initial AuraPOS defaults
  const handleResetDefaults = () => {
    resetAppearance();
    setDraft({
      mode: 'light',
      palette: 'blue',
      backgroundStyle: 'soft-tint',
      pattern: 'none'
    });
    setHasUnsavedChanges(false);
    triggerHaptic('medium');
    playAudioCue('remove');
    showToast({
      type: 'info',
      title: t('appearance.resetTitle', 'Default Theme Restored'),
      message: t('appearance.resetMsg', 'Restored to standard Aura Blue palette and light mode.')
    });
    announceAccessibility('Appearance settings reset to default');
  };

  const effectivePreviewMode = ThemeService.resolveEffectiveMode(draft.mode);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">
              {t('appearance.title', 'Theme & Appearance Engine')}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {t('appearance.subtitle', 'Customize color palettes, background tints, dark mode, and high-visibility POS tokens')}
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleCancelPreview}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          )}

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to default theme"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('appearance.reset', 'Default')}</span>
          </button>

          <button
            type="button"
            onClick={handleApplyTheme}
            disabled={!hasUnsavedChanges}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-blue-500 hover:bg-blue-600 text-white ring-2 ring-blue-300 active:scale-95'
                : 'bg-white/20 text-white/60 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{hasUnsavedChanges ? t('appearance.apply', 'Apply Theme') : t('appearance.current', 'Current Active')}</span>
          </button>
        </div>
      </div>

      {/* Unsaved Draft Alert Notice */}
      {hasUnsavedChanges && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-amber-900 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{t('appearance.previewMode', 'Live Preview Active')}:</strong> Review your design in the preview card below, then click <strong>Apply Theme</strong> to save across all terminals.
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplyTheme}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
          >
            {t('appearance.apply', 'Apply Now')}
          </button>
        </div>
      )}

      {/* 1. Theme Mode: Light, Dark, System */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{t('appearance.modeTitle', 'Theme Mode')}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('appearance.modeDesc', 'Select light mode for daytime brightness, dark mode for reduced eye strain, or system default')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'light', label: t('appearance.light', 'Light Mode'), icon: Sun, desc: 'Clean, bright POS environment' },
            { id: 'dark', label: t('appearance.dark', 'Dark Mode'), icon: Moon, desc: 'Deep high-contrast dark tones' },
            { id: 'system', label: t('appearance.system', 'System Default'), icon: Laptop, desc: 'Syncs with device operating system' }
          ].map(opt => {
            const Icon = opt.icon;
            const isSelected = draft.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleModeChange(opt.id as ThemeMode)}
                aria-pressed={isSelected}
                aria-label={`${opt.label}, ${isSelected ? 'selected' : 'not selected'}`}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Predefined Color Palettes (Requirement 2 & 17) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>{t('appearance.palettesTitle', 'Color Palettes')}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('appearance.palettesDesc', 'Architected semantic color systems that control primary buttons, card surfaces, and tinted backgrounds')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(THEME_PALETTES) as ThemePaletteId[]).map(palId => {
            const pal = THEME_PALETTES[palId];
            const isSelected = draft.palette === palId;
            const currentTokens = effectivePreviewMode === 'dark' ? pal.dark : pal.light;

            return (
              <button
                key={palId}
                type="button"
                onClick={() => handlePaletteChange(palId)}
                aria-pressed={isSelected}
                aria-label={`${pal.name} palette, ${isSelected ? 'selected' : 'not selected'}`}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-600 ring-2 ring-blue-500/25 shadow-xs'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{pal.name}</span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                    {pal.description}
                  </p>
                </div>

                {/* Color Swatch Trio */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 flex-1">
                    {/* Primary */}
                    <span
                      className="w-5 h-5 rounded-md shadow-2xs border border-white"
                      style={{ backgroundColor: pal.primaryHex }}
                      title={`Primary: ${pal.primaryHex}`}
                    />
                    {/* Secondary */}
                    <span
                      className="w-5 h-5 rounded-md shadow-2xs border border-white"
                      style={{ backgroundColor: pal.secondaryHex }}
                      title={`Secondary: ${pal.secondaryHex}`}
                    />
                    {/* Background Tint */}
                    <span
                      className="w-5 h-5 rounded-md shadow-2xs border border-slate-200"
                      style={{ backgroundColor: currentTokens.background }}
                      title={`Background Tint: ${currentTokens.background}`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase">
                    {pal.primaryHex}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Custom Color Configurator (Requirement 10) */}
      {draft.palette === 'custom' && (
        <section className="bg-slate-50 rounded-2xl border border-blue-200 p-6 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>{t('appearance.customBrandTitle', 'Custom Brand Palette Configurator')}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('appearance.customBrandDesc', 'Input your store brand hex codes. AuraPOS automatically validates accessibility ratios')}
              </p>
            </div>

            {/* WCAG Compliance Badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  contrastCheck.isAA
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {contrastCheck.isAA ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WCAG AA Pass ({contrastCheck.ratio}:1)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Low Contrast ({contrastCheck.ratio}:1)</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Primary */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColors.primary}
                  onChange={e => handleCustomColorChange('primary', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={customColors.primary}
                  onChange={e => handleCustomColorChange('primary', e.target.value)}
                  className="flex-1 font-mono text-xs font-bold uppercase p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>

            {/* Secondary */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Secondary / Accent</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColors.secondary || '#0ea5e9'}
                  onChange={e => handleCustomColorChange('secondary', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={customColors.secondary || '#0ea5e9'}
                  onChange={e => handleCustomColorChange('secondary', e.target.value)}
                  className="flex-1 font-mono text-xs font-bold uppercase p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>

            {/* Accent */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Highlight Tint</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColors.accent || '#38bdf8'}
                  onChange={e => handleCustomColorChange('accent', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={customColors.accent || '#38bdf8'}
                  onChange={e => handleCustomColorChange('accent', e.target.value)}
                  className="flex-1 font-mono text-xs font-bold uppercase p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>

            {/* Background Tint */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Background Subtle Tint</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColors.bgTint || '#f3f8fc'}
                  onChange={e => handleCustomColorChange('bgTint', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={customColors.bgTint || '#f3f8fc'}
                  onChange={e => handleCustomColorChange('bgTint', e.target.value)}
                  className="flex-1 font-mono text-xs font-bold uppercase p-2 rounded-lg border border-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Warning & Auto-Fix Banner if Contrast is Low */}
          {!contrastCheck.isAA && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{contrastCheck.warning}</span>
              </div>
              <button
                type="button"
                onClick={handleAutoAdjustContrast}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
              >
                Auto-Adjust for Safe Contrast
              </button>
            </div>
          )}
        </section>
      )}

      {/* 4. Background Style & Patterns (Requirements 3 & 4) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>{t('appearance.bgStyleTitle', 'Background Style & Texture')}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('appearance.bgStyleDesc', 'The selected palette tints the background naturally while maintaining readable POS product grids and cards')}
          </p>
        </div>

        {/* Background Style Options */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { id: 'soft-tint', label: 'Soft Tint', desc: 'Subtle palette hue' },
            { id: 'solid', label: 'Solid Tint', desc: 'Uniform smooth tone' },
            { id: 'gradient', label: 'Subtle Gradient', desc: 'Smooth diagonal transition' },
            { id: 'pattern', label: 'Pattern Texture', desc: 'Decorative geometric grain' },
            { id: 'minimal', label: 'Minimal Plain', desc: 'Neutral off-white' }
          ].map(style => {
            const isSelected = draft.backgroundStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => handleBgStyleChange(style.id as BackgroundStyle)}
                aria-pressed={isSelected}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-xs font-bold text-slate-900 block">{style.label}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">{style.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Decorative Pattern Picker (If pattern or any texture chosen) */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800">Subtle Background Pattern Overlay</span>
            <p className="text-[11px] text-slate-400">Zero-contrast interference geometric texture</p>
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'none', label: 'None', icon: Minus },
              { id: 'dots', label: 'Dots', icon: CircleDot },
              { id: 'grid', label: 'Grid', icon: Grid },
              { id: 'mesh', label: 'Mesh', icon: Sparkles }
            ].map(p => {
              const Icon = p.icon;
              const isSelected = draft.pattern === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePatternChange(p.id as PatternStyle)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Live Interactive Theme Preview (Requirement 11 & 5) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>{t('appearance.previewTitle', 'Live POS Terminal Preview')}</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('appearance.previewDesc', 'Simulated preview of the POS screen, category navigation, product cards, and hardware status')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Palette: <strong className="text-slate-800">{THEME_PALETTES[draft.palette]?.name || draft.palette}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-semibold text-slate-500 capitalize">
              Mode: <strong className="text-slate-800">{effectivePreviewMode}</strong>
            </span>
          </div>
        </div>

        {/* Live POS Mockup Container */}
        <div
          className="rounded-2xl border p-5 transition-all shadow-inner space-y-5"
          style={{
            backgroundColor: previewTokens.background,
            borderColor: previewTokens.border,
            color: previewTokens.textPrimary
          }}
        >
          {/* Simulated Header Bar */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border shadow-2xs"
            style={{
              backgroundColor: previewTokens.surface,
              borderColor: previewTokens.cardBorder
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                style={{
                  backgroundColor: previewTokens.button,
                  color: previewTokens.buttonText
                }}
              >
                AP
              </div>
              <div>
                <span className="text-xs font-bold block" style={{ color: previewTokens.textPrimary }}>
                  Store Register #1
                </span>
                <span className="text-[10px] block" style={{ color: previewTokens.textSecondary }}>
                  Active Cashier: Alex Martinez
                </span>
              </div>
            </div>

            {/* Hardware Status Chips (Requirement 15) */}
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold"
                style={{
                  backgroundColor: previewTokens.successBg,
                  color: previewTokens.success
                }}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>✓ Thermal Printer Ready</span>
              </span>

              <span
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold"
                style={{
                  backgroundColor: previewTokens.warningBg,
                  color: previewTokens.warning
                }}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>⚠ Paper Roll Low</span>
              </span>
            </div>
          </div>

          {/* Simulated Category Bar (Requirement 7) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span
              className="px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-default"
              style={{
                backgroundColor: previewTokens.button,
                color: previewTokens.buttonText
              }}
            >
              <Check className="w-3 h-3" />
              <span>All Products</span>
            </span>

            {['Hot Beverages', 'Bakery & Pastries', 'Lunch Specials', 'Cold Drinks'].map((cat, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border cursor-default"
                style={{
                  backgroundColor: previewTokens.surface,
                  borderColor: previewTokens.cardBorder,
                  color: previewTokens.textSecondary
                }}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Simulated Product Cards Grid (Requirement 6) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { name: 'Artisan Latte', price: '$4.50', stock: '✓ 14 in stock', cat: 'Hot Beverages' },
              { name: 'Almond Croissant', price: '$3.75', stock: '⚠ 3 left', cat: 'Bakery' },
              { name: 'Cold Brew Blend', price: '$4.00', stock: '✓ 28 in stock', cat: 'Cold Drinks' }
            ].map((prod, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border flex flex-col justify-between gap-3 shadow-2xs"
                style={{
                  backgroundColor: previewTokens.card,
                  borderColor: previewTokens.cardBorder
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: previewTokens.surfaceVariant,
                        color: previewTokens.primary
                      }}
                    >
                      {prod.cat}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: previewTokens.textSecondary }}>
                      {prod.stock}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold mt-1" style={{ color: previewTokens.textPrimary }}>
                    {prod.name}
                  </h5>
                </div>

                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: previewTokens.divider }}>
                  <span className="text-sm font-black font-mono" style={{ color: previewTokens.textPrimary }}>
                    {prod.price}
                  </span>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs"
                    style={{
                      backgroundColor: previewTokens.button,
                      color: previewTokens.buttonText
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Simulated Cart Bottom Bar (Requirement 5 & 8) */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xs"
            style={{
              backgroundColor: previewTokens.surface,
              borderColor: previewTokens.cardBorder
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold" style={{ color: previewTokens.textPrimary }}>
                Order #1024 (3 items)
              </span>
              <span className="text-xs text-slate-300">|</span>
              <span className="text-xs" style={{ color: previewTokens.textSecondary }}>
                Subtotal: $12.25 · Tax: $1.23
              </span>
              <span className="text-sm font-black font-mono" style={{ color: previewTokens.textPrimary }}>
                Total: $13.48
              </span>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl text-xs font-black tracking-wide uppercase shadow-sm flex items-center justify-center gap-2 cursor-default"
              style={{
                backgroundColor: previewTokens.button,
                color: previewTokens.buttonText
              }}
            >
              <span>CHARGE $13.48</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancelPreview}
            disabled={!hasUnsavedChanges}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            {t('common.cancel', 'Discard Changes')}
          </button>

          <button
            type="button"
            onClick={handleApplyTheme}
            disabled={!hasUnsavedChanges}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              hasUnsavedChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{t('appearance.apply', 'Apply Theme')}</span>
          </button>
        </div>
      </section>

      {/* 6. Accessibility & Hardware Notice (Requirement 13 & 21) */}
      <section className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">
            {t('appearance.receiptNoticeTitle', 'Thermal Printing & Camera Safety Guaranteed')}
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            AuraPOS ensures that thermal receipt printing formats (ESC/POS) remain in crisp black-and-white.
            Payment QR codes and camera barcode scanners are protected from background tints to ensure 100% scanning reliability on physical Android POS terminals.
          </p>
        </div>
      </section>
    </div>
  );
};
