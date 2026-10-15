/**
 * Loyverse POS Appearance & Dynamic Theme Engine
 * Palettes:
 *  - Emerald (Default Loyverse Green)
 *  - Blue (Modern POS)
 *  - Indigo (Royal)
 *  - Purple (Luxury)
 *  - Teal (Fresh)
 *  - Orange (Bakery/Fast Food)
 *  - Red (Steakhouse/Deli)
 *  - Rose (Boutique Cafe)
 *  - Slate (Minimalist)
 *  - Premium Dark (OLED Black)
 *  - High Contrast (Accessibility)
 */

export interface ThemePalette {
  id: string;
  name: string;
  primaryHex: string;
  primaryLight: string;
  primaryDark: string;
  accentHex: string;
  badgeBg: string;
  badgeText: string;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'emerald',
    name: 'Loyverse Emerald',
    primaryHex: '#10b981',
    primaryLight: '#34d399',
    primaryDark: '#059669',
    accentHex: '#047857',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    primaryHex: '#3b82f6',
    primaryLight: '#60a5fa',
    primaryDark: '#2563eb',
    accentHex: '#1d4ed8',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-400',
  },
  {
    id: 'indigo',
    name: 'Modern Indigo',
    primaryHex: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    accentHex: '#4338ca',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-400',
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    primaryHex: '#a855f7',
    primaryLight: '#c084fc',
    primaryDark: '#9333ea',
    accentHex: '#7e22ce',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-400',
  },
  {
    id: 'teal',
    name: 'Nordic Teal',
    primaryHex: '#14b8a6',
    primaryLight: '#2dd4bf',
    primaryDark: '#0d9488',
    accentHex: '#0f766e',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-400',
  },
  {
    id: 'orange',
    name: 'Bakery Amber',
    primaryHex: '#f59e0b',
    primaryLight: '#fbbf24',
    primaryDark: '#d97706',
    accentHex: '#b45309',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
  },
  {
    id: 'red',
    name: 'Bistro Red',
    primaryHex: '#ef4444',
    primaryLight: '#f87171',
    primaryDark: '#dc2626',
    accentHex: '#b91c1c',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-400',
  },
  {
    id: 'rose',
    name: 'Boutique Rose',
    primaryHex: '#f43f5e',
    primaryLight: '#fb7185',
    primaryDark: '#e11d48',
    accentHex: '#be123c',
    badgeBg: 'bg-pink-500/20',
    badgeText: 'text-pink-400',
  },
  {
    id: 'slate',
    name: 'Mono Slate',
    primaryHex: '#64748b',
    primaryLight: '#94a3b8',
    primaryDark: '#475569',
    accentHex: '#334155',
    badgeBg: 'bg-slate-500/20',
    badgeText: 'text-slate-300',
  },
  {
    id: 'dark',
    name: 'OLED Darkness',
    primaryHex: '#38bdf8',
    primaryLight: '#7dd3fc',
    primaryDark: '#0284c7',
    accentHex: '#0369a1',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-400',
  },
];

export type BackgroundPattern = 'solid' | 'dots' | 'grid' | 'mesh';

export interface ThemeConfig {
  paletteId: string;
  customHex?: string;
  pattern: BackgroundPattern;
  mode: 'dark' | 'light' | 'system';
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  paletteId: 'emerald',
  pattern: 'dots',
  mode: 'dark',
};

export function getBackgroundPatternCss(pattern: BackgroundPattern): string {
  switch (pattern) {
    case 'dots':
      return 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)';
    case 'grid':
      return 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)';
    case 'mesh':
      return 'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.08) 0px, transparent 50%)';
    default:
      return 'none';
  }
}
