import React, { useState } from 'react';
import { usePOS } from '../../../context/POSContext.tsx';
import {
  Accessibility,
  Eye,
  Type,
  Maximize2,
  Minimize2,
  Volume2,
  Vibrate,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sliders,
  Hand,
  Layers,
  Palette,
  MonitorCheck,
  MousePointerClick,
  Check
} from 'lucide-react';
import {
  ColorBlindMode,
  ContrastMode,
  TextScale,
  TouchTargetSize
} from '../../../types/pos.ts';

export const AccessibilitySettingsTab: React.FC = () => {
  const {
    accessibility,
    updateAccessibility,
    resetAccessibility,
    announceAccessibility,
    triggerHaptic,
    playAudioCue,
    showToast,
    t
  } = usePOS();

  const [testSpeechText, setTestSpeechText] = useState<string>('Margherita Pizza added to order, total 14 dollars');

  const handleTextScaleChange = (scale: TextScale) => {
    updateAccessibility({ textScale: scale });
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Font scale set to ${scale}`);
  };

  const handleContrastChange = (contrast: ContrastMode) => {
    updateAccessibility({ contrastMode: contrast });
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Contrast mode set to ${contrast}`);
  };

  const handleTouchSizeChange = (size: TouchTargetSize) => {
    updateAccessibility({ touchTargetSize: size });
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Touch target size set to ${size}`);
  };

  const handleColorBlindChange = (mode: ColorBlindMode) => {
    updateAccessibility({ colorBlindMode: mode });
    triggerHaptic('light');
    playAudioCue('click');
    announceAccessibility(`Color blind mode set to ${mode}`);
  };

  const handleToggle = (key: keyof typeof accessibility, label: string) => {
    const currentVal = Boolean(accessibility[key]);
    const nextVal = !currentVal;
    updateAccessibility({ [key]: nextVal });
    triggerHaptic(nextVal ? 'success' : 'light');
    playAudioCue('click');
    announceAccessibility(`${label} ${nextVal ? 'enabled' : 'disabled'}`);
  };

  const handleReset = () => {
    resetAccessibility();
    triggerHaptic('medium');
    playAudioCue('remove');
    showToast({
      type: 'info',
      title: t('a11y.resetTitle', 'Accessibility Defaults Restored'),
      message: t('a11y.resetMsg', 'All accessibility settings have been restored to standard values.')
    });
    announceAccessibility('Accessibility settings reset to default');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
            <Accessibility className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {t('a11y.title', 'Universal Accessibility System')}
            </h2>
            <p className="text-xs text-blue-200 mt-1 max-w-xl">
              {t(
                'a11y.subtitle',
                'Empower every cashier, manager, and customer with large text, high-contrast OLED modes, color-blind cues, touch scaling, haptics, and TalkBack integration.'
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white transition-all shadow-sm"
          aria-label="Restore standard accessibility defaults"
        >
          <RotateCcw className="w-4 h-4" />
          {t('a11y.restoreDefaults', 'Restore Defaults')}
        </button>
      </div>

      {/* Live Accessibility Interactive Preview Card */}
      <div className="bg-white border-2 border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {t('a11y.livePreview', 'Live POS Preview & Ergonomics Tester')}
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            Scale: {accessibility.textScale.toUpperCase()} • Touch: {accessibility.touchTargetSize.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/70">
          {/* Sample Product Button */}
          <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">Classic Burger</span>
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">$12.00</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                100% Angus beef patty, cheddar, lettuce, tomato & house sauce.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ✓ In Stock (24)
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  playAudioCue('add');
                  announceAccessibility('Added sample Classic Burger to preview cart');
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                aria-label="Add sample Classic Burger for 12 dollars"
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                + Add
              </button>
            </div>
          </div>

          {/* Sample Keypad Digit */}
          <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-700 mb-2">Keypad Key Target</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                playAudioCue('click');
                announceAccessibility('Keypad 5 pressed');
              }}
              className="w-full py-4 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 border-2 border-slate-200 rounded-xl font-black text-2xl text-slate-900 shadow-2xs transition-all flex items-center justify-center"
              aria-label="Digit 5 numeric key"
            >
              5
            </button>
            <span className="text-[10px] text-center text-slate-400 mt-2 font-medium">Click to test touch target & audio</span>
          </div>

          {/* Sample Hardware Status Indicators (Color-blind friendly) */}
          <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
            <span className="text-xs font-bold text-slate-700">Status Symbols (Color-Blind Cues)</span>
            <div className="space-y-1.5 text-xs font-medium">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>✓ Printer Online (USB)</span>
              </div>
              <div className="flex items-center gap-2 text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-md">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>⚠ Paper Low (Roll at 15%)</span>
              </div>
              <div className="flex items-center gap-2 text-rose-800 bg-rose-50/80 px-2.5 py-1 rounded-md">
                <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>✕ Offline Sync Pending (3)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Vision & Typography */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Type className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {t('a11y.visionTypography', '1. Vision & Typography')}
            </h3>
          </div>

          {/* Font Scale Stepper */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              {t('a11y.textScale', 'Dynamic Text Scaling')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'normal', label: '100%', sub: 'Normal' },
                { id: 'large', label: '115%', sub: 'Large' },
                { id: 'xlarge', label: '130%', sub: 'X-Large' },
                { id: 'maximum', label: '150%', sub: 'Max' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTextScaleChange(opt.id as TextScale)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    accessibility.textScale === opt.id
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  aria-pressed={accessibility.textScale === opt.id}
                  aria-label={`Set font size to ${opt.sub} (${opt.label})`}
                >
                  <div className="text-base font-black">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Contrast Mode */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              {t('a11y.contrastMode', 'Contrast & Legibility')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: 'Standard', desc: 'Default Colors' },
                { id: 'high', label: 'High Contrast', desc: 'Thick Borders' },
                { id: 'extra-high', label: 'OLED Extra', desc: 'Pure Black & Gold' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleContrastChange(opt.id as ContrastMode)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    accessibility.contrastMode === opt.id
                      ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  aria-pressed={accessibility.contrastMode === opt.id}
                  aria-label={`Contrast mode: ${opt.label}`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Blind Mode */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              {t('a11y.colorBlindMode', 'Color Vision Assistance')}
            </label>
            <select
              value={accessibility.colorBlindMode}
              onChange={e => handleColorBlindChange(e.target.value as ColorBlindMode)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select color blind optimization mode"
            >
              <option value="none">Standard Full Spectrum</option>
              <option value="protanopia">Protanopia (Red-Weak / Red-Blind)</option>
              <option value="deuteranopia">Deuteranopia (Green-Weak / Green-Blind)</option>
              <option value="tritanopia">Tritanopia (Blue-Yellow Blind)</option>
              <option value="monochrome">Monochrome / High Grayscale Contrast</option>
            </select>
          </div>

          {/* Toggles in Vision */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Bold Typography</span>
                <span className="text-[11px] text-slate-500">Increases all text weight to medium/bold across headers and inputs.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.boldText}
                onChange={() => handleToggle('boldText', 'Bold Typography')}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                aria-label="Toggle bold typography"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Reduce Transparency</span>
                <span className="text-[11px] text-slate-500">Replaces translucent backdrops with solid opaque backgrounds.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.reduceTransparency}
                onChange={() => handleToggle('reduceTransparency', 'Reduce Transparency')}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                aria-label="Toggle reduce transparency"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">High-Visibility Focus Rings</span>
                <span className="text-[11px] text-slate-500">Draws distinct glowing outline rings on active keyboard focus.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.focusIndicators}
                onChange={() => handleToggle('focusIndicators', 'High Visibility Focus Rings')}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                aria-label="Toggle high visibility focus rings"
              />
            </label>
          </div>
        </div>

        {/* Section 2: Touch & Motor Ergonomics */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Hand className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {t('a11y.touchErgonomics', '2. Touch & Motor Ergonomics')}
            </h3>
          </div>

          {/* Touch Target Minimum Size */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              {t('a11y.touchTargetSize', 'Touch Target Minimum Size')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: '44dp', sub: 'Standard' },
                { id: 'large', label: '52dp', sub: 'Comfortable' },
                { id: 'xlarge', label: '60dp', sub: 'Maximum POS' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTouchSizeChange(opt.id as TouchTargetSize)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    accessibility.touchTargetSize === opt.id
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  aria-pressed={accessibility.touchTargetSize === opt.id}
                  aria-label={`Set touch target size to ${opt.sub} (${opt.label})`}
                >
                  <div className="text-sm font-black">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Simplified POS Mode Banner */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900">Simplified POS Mode</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.simplifiedPos}
                onChange={() => handleToggle('simplifiedPos', 'Simplified POS Mode')}
                className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                aria-label="Toggle simplified POS mode"
              />
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Minimizes visual distractions, maximizes product button sizes, and enlarges the checkout register flow for assisted operations.
            </p>
          </div>

          {/* Toggles in Motor */}
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Increased Control Spacing</span>
                <span className="text-[11px] text-slate-500">Expands padding between keypad keys and menu buttons to prevent accidental taps.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.extraSpacing}
                onChange={() => handleToggle('extraSpacing', 'Increased Control Spacing')}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                aria-label="Toggle increased control spacing"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Reduce Motion</span>
                <span className="text-[11px] text-slate-500">Replaces sliding transitions with instant, stable layout changes.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.reduceMotion}
                onChange={() => handleToggle('reduceMotion', 'Reduce Motion')}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                aria-label="Toggle reduce motion"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Disable All Animations</span>
                <span className="text-[11px] text-slate-500">Turns off micro-interactions and spinners for maximum responsiveness.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.disableAnimations}
                onChange={() => handleToggle('disableAnimations', 'Disable All Animations')}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                aria-label="Toggle disable all animations"
              />
            </label>
          </div>
        </div>

        {/* Section 3: Audio, Haptics & Hearing */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Volume2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {t('a11y.audioHaptics', '3. Haptic & Audio Feedback')}
            </h3>
          </div>

          <div className="space-y-3">
            {/* Haptic Feedback */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Vibrate className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Haptic Vibration Cues</span>
                    <span className="text-[11px] text-slate-500">Tactile pulses when items are added, payments confirm, or errors trigger.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={accessibility.hapticFeedback}
                  onChange={() => handleToggle('hapticFeedback', 'Haptic Vibration Cues')}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  aria-label="Toggle haptic vibration cues"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => triggerHaptic('light')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Light Tap
                </button>
                <button
                  type="button"
                  onClick={() => triggerHaptic('success')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 transition-all"
                >
                  Success Pulse
                </button>
                <button
                  type="button"
                  onClick={() => triggerHaptic('error')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition-all"
                >
                  Error Buzz
                </button>
              </div>
            </div>

            {/* Audio Feedback */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Synthesized Audio Cues</span>
                    <span className="text-[11px] text-slate-500">Harmonic Web Audio confirmation chimes on register actions.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={accessibility.audioFeedback}
                  onChange={() => handleToggle('audioFeedback', 'Synthesized Audio Cues')}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  aria-label="Toggle synthesized audio cues"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => playAudioCue('add')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Add Chime
                </button>
                <button
                  type="button"
                  onClick={() => playAudioCue('pay')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 transition-all"
                >
                  Payment Chord
                </button>
                <button
                  type="button"
                  onClick={() => playAudioCue('beep')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-blue-700 hover:bg-blue-50 transition-all"
                >
                  Scanner Beep
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Screen Reader & TalkBack */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Accessibility className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {t('a11y.screenReaderTalkBack', '4. Screen Reader & TalkBack')}
            </h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Screen Reader Optimization</span>
                <span className="text-[11px] text-slate-500">Injects rich ARIA semantics, role descriptions, and status regions.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.screenReaderOptimization}
                onChange={() => handleToggle('screenReaderOptimization', 'Screen Reader Optimization')}
                className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-slate-300"
                aria-label="Toggle screen reader optimization"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 cursor-pointer hover:bg-slate-50">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Spoken Voice Feedback</span>
                <span className="text-[11px] text-slate-500">Speaks cart updates and totals aloud for vision-impaired operators.</span>
              </div>
              <input
                type="checkbox"
                checked={accessibility.spokenFeedback}
                onChange={() => handleToggle('spokenFeedback', 'Spoken Voice Feedback')}
                className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-slate-300"
                aria-label="Toggle spoken voice feedback"
              />
            </label>

            {/* Test Voice Announcement */}
            <div className="p-3.5 rounded-xl bg-violet-50/80 border border-violet-200/80 space-y-2">
              <label className="text-[11px] font-bold text-violet-900 block">Test Live Speech Announcement</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testSpeechText}
                  onChange={e => setTestSpeechText(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-violet-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  aria-label="Custom speech test announcement text"
                />
                <button
                  type="button"
                  onClick={() => announceAccessibility(testSpeechText, 'polite')}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  aria-label="Speak announcement aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Speak
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
