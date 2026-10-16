/**
 * Color Theme Presets & Styles for AuraPOS
 */

import { ThemeService, THEME_PALETTES } from '../services/themeService.ts';

export type ThemeColor = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate' | 'teal';

export interface ThemePreset {
  id: ThemeColor;
  name: string;
  description: string;
  hex: string;
  previewClass: string;
  shades: {
    50: string;
    100: string;
    200: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  btnPrimary: string;
  btnHover: string;
  bgLight: string;
  textAccent: string;
  borderAccent: string;
  ringFocus: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'blue',
    name: 'Sapphire Blue',
    description: 'Modern Tech & High-Speed Retail',
    hex: '#2563eb',
    previewClass: 'bg-blue-600',
    shades: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    },
    btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    btnHover: 'hover:bg-blue-700',
    bgLight: 'bg-blue-50 text-blue-700 border-blue-200',
    textAccent: 'text-blue-600',
    borderAccent: 'border-blue-500',
    ringFocus: 'focus:ring-blue-500'
  },
  {
    id: 'emerald',
    name: 'Emerald Market',
    description: 'Fresh Produce, Organic & Healthy Café',
    hex: '#059669',
    previewClass: 'bg-emerald-600',
    shades: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b'
    },
    btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    btnHover: 'hover:bg-emerald-700',
    bgLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    textAccent: 'text-emerald-600',
    borderAccent: 'border-emerald-500',
    ringFocus: 'focus:ring-emerald-500'
  },
  {
    id: 'violet',
    name: 'Amethyst Luxury',
    description: 'Boutiques, Salons & Artisan Roasters',
    hex: '#7c3aed',
    previewClass: 'bg-violet-600',
    shades: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95'
    },
    btnPrimary: 'bg-violet-600 hover:bg-violet-700 text-white',
    btnHover: 'hover:bg-violet-700',
    bgLight: 'bg-violet-50 text-violet-700 border-violet-200',
    textAccent: 'text-violet-600',
    borderAccent: 'border-violet-500',
    ringFocus: 'focus:ring-violet-500'
  },
  {
    id: 'amber',
    name: 'Golden Amber',
    description: 'Warm Bakeries, Coffee & Bistro Pubs',
    hex: '#d97706',
    previewClass: 'bg-amber-600',
    shades: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f'
    },
    btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white',
    btnHover: 'hover:bg-amber-700',
    bgLight: 'bg-amber-50 text-amber-800 border-amber-200',
    textAccent: 'text-amber-600',
    borderAccent: 'border-amber-500',
    ringFocus: 'focus:ring-amber-500'
  },
  {
    id: 'rose',
    name: 'Ruby Rose',
    description: 'Fine Dining, Steakhouses & Fashion',
    hex: '#e11d48',
    previewClass: 'bg-rose-600',
    shades: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337'
    },
    btnPrimary: 'bg-rose-600 hover:bg-rose-700 text-white',
    btnHover: 'hover:bg-rose-700',
    bgLight: 'bg-rose-50 text-rose-700 border-rose-200',
    textAccent: 'text-rose-600',
    borderAccent: 'border-rose-500',
    ringFocus: 'focus:ring-rose-500'
  },
  {
    id: 'slate',
    name: 'Obsidian Slate',
    description: 'Minimalist Monochrome & Contemporary Design',
    hex: '#334155',
    previewClass: 'bg-slate-800',
    shades: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      500: '#64748b',
      600: '#334155',
      700: '#1e293b',
      800: '#0f172a',
      900: '#020617'
    },
    btnPrimary: 'bg-slate-800 hover:bg-slate-900 text-white',
    btnHover: 'hover:bg-slate-900',
    bgLight: 'bg-slate-100 text-slate-800 border-slate-300',
    textAccent: 'text-slate-800',
    borderAccent: 'border-slate-700',
    ringFocus: 'focus:ring-slate-700'
  },
  {
    id: 'teal',
    name: 'Nordic Teal',
    description: 'Clean Scandinavian & Botanical Retail',
    hex: '#0d9488',
    previewClass: 'bg-teal-600',
    shades: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a'
    },
    btnPrimary: 'bg-teal-600 hover:bg-teal-700 text-white',
    btnHover: 'hover:bg-teal-700',
    bgLight: 'bg-teal-50 text-teal-700 border-teal-200',
    textAccent: 'text-teal-600',
    borderAccent: 'border-teal-500',
    ringFocus: 'focus:ring-teal-500'
  }
];

export function getTheme(themeId?: string): ThemePreset {
  const found = THEME_PRESETS.find(t => t.id === themeId);
  return found || THEME_PRESETS[0];
}

/**
 * Applies CSS root variables according to current theme color and appearance
 */
export function applyThemeVariables(themeId: ThemeColor = 'emerald', mode?: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;

  // Delegate to full centralized ThemeService
  ThemeService.applyToDOM({
    mode: mode || 'light',
    palette: themeId as any,
    backgroundStyle: 'soft-tint',
    pattern: 'none'
  });
}
