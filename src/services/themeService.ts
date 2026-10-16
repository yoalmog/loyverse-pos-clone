/**
 * AuraPOS - Production-Grade Centralized Theme & Appearance Engine
 * 
 * Manages:
 * 1. Predefined & custom palettes (Aura Blue, Emerald, Purple, Orange, Red, Teal, Slate, Rose, Indigo, Custom).
 * 2. Light, Dark, and System Default modes with real-time OS preference sync.
 * 3. Subtle background tints, gradients, and pattern styles that elevate readability.
 * 4. Full semantic token systems (surface, card, text, border, button, status).
 * 5. WCAG 2.1 relative luminance & contrast ratio calculation with accessible suggestions.
 * 6. Zero-friction integration with existing Accessibility & Receipt printing subsystems.
 */

import {
  AppearanceSettings,
  BackgroundStyle,
  CustomThemeColors,
  PatternStyle,
  StoreSettings,
  ThemeMode,
  ThemePaletteId
} from '../types/pos.ts';

export interface SemanticColorTokens {
  primary: string;
  primaryContainer: string;
  primaryVariant: string;
  secondary: string;
  secondaryContainer: string;
  accent: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceVariant: string;
  card: string;
  cardSelected: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  divider: string;
  icon: string;
  button: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonText: string;
  buttonHover: string;
  selected: string;
  hover: string;
  focus: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;
  offline: string;
  online: string;
  pending: string;
  badgeBg: string;
  badgeText: string;
}

export interface ThemePaletteDefinition {
  id: ThemePaletteId;
  name: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  light: Partial<SemanticColorTokens>;
  dark: Partial<SemanticColorTokens>;
}

// Helper to ensure all required semantic tokens are fully populated
export function fillTokens(t: Partial<SemanticColorTokens>): SemanticColorTokens {
  const primary = t.primary || '#2563eb';
  const secondary = t.secondary || '#3b82f6';
  const surfaceVariant = t.surfaceVariant || '#f0f5ff';
  const cardBorder = t.cardBorder || '#dbeafe';

  return {
    primary,
    primaryContainer: t.primaryContainer || surfaceVariant,
    primaryVariant: t.primaryVariant || primary,
    secondary,
    secondaryContainer: t.secondaryContainer || cardBorder,
    accent: t.accent || secondary,
    background: t.background || '#f4f7fc',
    backgroundSecondary: t.backgroundSecondary || '#eaf0fa',
    surface: t.surface || '#ffffff',
    surfaceVariant,
    card: t.card || '#ffffff',
    cardSelected: t.cardSelected || t.selected || surfaceVariant,
    cardBorder,
    textPrimary: t.textPrimary || '#0f172a',
    textSecondary: t.textSecondary || '#475569',
    textDisabled: t.textDisabled || '#94a3b8',
    border: t.border || '#cbd5e1',
    divider: t.divider || '#e2e8f0',
    icon: t.icon || primary,
    button: t.button || primary,
    buttonPrimary: t.buttonPrimary || t.button || primary,
    buttonSecondary: t.buttonSecondary || secondary,
    buttonText: t.buttonText || '#ffffff',
    buttonHover: t.buttonHover || primary,
    selected: t.selected || surfaceVariant,
    hover: t.hover || '#f1f5f9',
    focus: t.focus || primary,
    success: t.success || STATUS_COLORS.success,
    successBg: t.successBg || STATUS_COLORS.successLight,
    warning: t.warning || STATUS_COLORS.warning,
    warningBg: t.warningBg || STATUS_COLORS.warningLight,
    error: t.error || STATUS_COLORS.error,
    errorBg: t.errorBg || STATUS_COLORS.errorLight,
    info: t.info || STATUS_COLORS.info,
    infoBg: t.infoBg || STATUS_COLORS.infoLight,
    offline: t.offline || STATUS_COLORS.offline,
    online: t.online || STATUS_COLORS.online,
    pending: t.pending || STATUS_COLORS.pending,
    badgeBg: t.badgeBg || surfaceVariant,
    badgeText: t.badgeText || primary
  };
}

// -------------------------------------------------------------
// Status Colors (Requirement 14 - Stable across all themes)
// -------------------------------------------------------------
export const STATUS_COLORS = {
  success: '#10b981',
  successLight: '#ecfdf5',
  successDark: '#064e3b',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  warningDark: '#78350f',
  error: '#ef4444',
  errorLight: '#fef2f2',
  errorDark: '#7f1d1d',
  info: '#3b82f6',
  infoLight: '#eff6ff',
  infoDark: '#1e3a8a',
  offline: '#64748b',
  offlineBg: '#f1f5f9',
  online: '#10b981',
  onlineBg: '#ecfdf5',
  pending: '#eab308',
  processing: '#8b5cf6'
};

// -------------------------------------------------------------
// 10 Predefined Palettes (Requirement 2 & 3)
// -------------------------------------------------------------
export const THEME_PALETTES: Record<ThemePaletteId, ThemePaletteDefinition> = {
  blue: {
    id: 'blue',
    name: 'Aura Blue',
    description: 'Modern Tech, High-Speed Retail & Quick-Service POS',
    primaryHex: '#2563eb',
    secondaryHex: '#3b82f6',
    accentHex: '#60a5fa',
    light: {
      primary: '#2563eb',
      primaryVariant: '#1d4ed8',
      secondary: '#3b82f6',
      accent: '#60a5fa',
      background: '#f4f7fc',
      backgroundSecondary: '#eaf0fa',
      surface: '#ffffff',
      surfaceVariant: '#f0f5ff',
      card: '#ffffff',
      cardBorder: '#dbeafe',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#2563eb',
      button: '#2563eb',
      buttonText: '#ffffff',
      buttonHover: '#1d4ed8',
      selected: '#eff6ff',
      hover: '#f1f5f9',
      focus: '#2563eb',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#2563eb',
      infoBg: '#eff6ff',
      badgeBg: '#dbeafe',
      badgeText: '#1e40af'
    },
    dark: {
      primary: '#3b82f6',
      primaryVariant: '#2563eb',
      secondary: '#60a5fa',
      accent: '#93c5fd',
      background: '#0a0f1d',
      backgroundSecondary: '#11182c',
      surface: '#151d36',
      surfaceVariant: '#1e294b',
      card: '#151d36',
      cardBorder: '#23325e',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#2a3a66',
      divider: '#1e294b',
      icon: '#60a5fa',
      button: '#3b82f6',
      buttonText: '#ffffff',
      buttonHover: '#2563eb',
      selected: '#1e294b',
      hover: '#1a2340',
      focus: '#60a5fa',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#60a5fa',
      infoBg: '#1e3a8a',
      badgeBg: '#1e294b',
      badgeText: '#93c5fd'
    }
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Market',
    description: 'Fresh Produce, Organic Grocery & Healthy Cafés',
    primaryHex: '#059669',
    secondaryHex: '#10b981',
    accentHex: '#34d399',
    light: {
      primary: '#059669',
      primaryVariant: '#047857',
      secondary: '#10b981',
      accent: '#34d399',
      background: '#f2fbf6',
      backgroundSecondary: '#e4f7ed',
      surface: '#ffffff',
      surfaceVariant: '#ecfdf5',
      card: '#ffffff',
      cardBorder: '#d1fae5',
      textPrimary: '#064e3b',
      textSecondary: '#334155',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#059669',
      button: '#059669',
      buttonText: '#ffffff',
      buttonHover: '#047857',
      selected: '#ecfdf5',
      hover: '#f1f5f9',
      focus: '#059669',
      success: '#059669',
      successBg: '#ecfdf5',
      warning: '#d97706',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#0d9488',
      infoBg: '#f0fdfa',
      badgeBg: '#d1fae5',
      badgeText: '#065f46'
    },
    dark: {
      primary: '#10b981',
      primaryVariant: '#059669',
      secondary: '#34d399',
      accent: '#6ee7b7',
      background: '#071510',
      backgroundSecondary: '#0c221a',
      surface: '#112f24',
      surfaceVariant: '#174031',
      card: '#112f24',
      cardBorder: '#1c4d3b',
      textPrimary: '#f0fdf4',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#1f5441',
      divider: '#174031',
      icon: '#34d399',
      button: '#10b981',
      buttonText: '#ffffff',
      buttonHover: '#059669',
      selected: '#174031',
      hover: '#13362a',
      focus: '#34d399',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#2dd4bf',
      infoBg: '#134e4a',
      badgeBg: '#174031',
      badgeText: '#a7f3d0'
    }
  },
  purple: {
    id: 'purple',
    name: 'Purple Luxury',
    description: 'Boutiques, Salons, Artisan Roasters & Craft Studios',
    primaryHex: '#7c3aed',
    secondaryHex: '#8b5cf6',
    accentHex: '#a78bfa',
    light: {
      primary: '#7c3aed',
      primaryVariant: '#6d28d9',
      secondary: '#8b5cf6',
      accent: '#a78bfa',
      background: '#f8f5fc',
      backgroundSecondary: '#f0ebf9',
      surface: '#ffffff',
      surfaceVariant: '#f5f3ff',
      card: '#ffffff',
      cardBorder: '#ede9fe',
      textPrimary: '#1e1b4b',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#7c3aed',
      button: '#7c3aed',
      buttonText: '#ffffff',
      buttonHover: '#6d28d9',
      selected: '#f5f3ff',
      hover: '#f1f5f9',
      focus: '#7c3aed',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#7c3aed',
      infoBg: '#f5f3ff',
      badgeBg: '#ede9fe',
      badgeText: '#5b21b6'
    },
    dark: {
      primary: '#8b5cf6',
      primaryVariant: '#7c3aed',
      secondary: '#a78bfa',
      accent: '#c4b5fd',
      background: '#100a1f',
      backgroundSecondary: '#191130',
      surface: '#221743',
      surfaceVariant: '#2f1f5c',
      card: '#221743',
      cardBorder: '#3b2773',
      textPrimary: '#f5f3ff',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#412b7f',
      divider: '#2f1f5c',
      icon: '#a78bfa',
      button: '#8b5cf6',
      buttonText: '#ffffff',
      buttonHover: '#7c3aed',
      selected: '#2f1f5c',
      hover: '#291b50',
      focus: '#a78bfa',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#a78bfa',
      infoBg: '#4c1d95',
      badgeBg: '#2f1f5c',
      badgeText: '#ddd6fe'
    }
  },
  orange: {
    id: 'orange',
    name: 'Warm Amber & Orange',
    description: 'Bakeries, Coffee Bistros, Pizzerias & Breweries',
    primaryHex: '#d97706',
    secondaryHex: '#f59e0b',
    accentHex: '#fbbf24',
    light: {
      primary: '#d97706',
      primaryVariant: '#b45309',
      secondary: '#f59e0b',
      accent: '#fbbf24',
      background: '#fdf9f2',
      backgroundSecondary: '#f9f0e1',
      surface: '#ffffff',
      surfaceVariant: '#fffbeb',
      card: '#ffffff',
      cardBorder: '#fef3c7',
      textPrimary: '#451a03',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#d97706',
      button: '#d97706',
      buttonText: '#ffffff',
      buttonHover: '#b45309',
      selected: '#fffbeb',
      hover: '#f1f5f9',
      focus: '#d97706',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#d97706',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#d97706',
      infoBg: '#fffbeb',
      badgeBg: '#fef3c7',
      badgeText: '#92400e'
    },
    dark: {
      primary: '#f59e0b',
      primaryVariant: '#d97706',
      secondary: '#fbbf24',
      accent: '#fcd34d',
      background: '#160c04',
      backgroundSecondary: '#241407',
      surface: '#331c0a',
      surfaceVariant: '#46270e',
      card: '#331c0a',
      cardBorder: '#5c3313',
      textPrimary: '#fffbeb',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#6b3c16',
      divider: '#46270e',
      icon: '#fbbf24',
      button: '#f59e0b',
      buttonText: '#180e06',
      buttonHover: '#d97706',
      selected: '#46270e',
      hover: '#3b200b',
      focus: '#fbbf24',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#fbbf24',
      infoBg: '#78350f',
      badgeBg: '#46270e',
      badgeText: '#fde68a'
    }
  },
  red: {
    id: 'red',
    name: 'Crimson Red',
    description: 'Fine Dining, Steakhouses, Burgers & Passion Brands',
    primaryHex: '#dc2626',
    secondaryHex: '#ef4444',
    accentHex: '#f87171',
    light: {
      primary: '#dc2626',
      primaryVariant: '#b91c1c',
      secondary: '#ef4444',
      accent: '#f87171',
      background: '#fdf4f5',
      backgroundSecondary: '#fae6e9',
      surface: '#ffffff',
      surfaceVariant: '#fef2f2',
      card: '#ffffff',
      cardBorder: '#fee2e2',
      textPrimary: '#450a0a',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#dc2626',
      button: '#dc2626',
      buttonText: '#ffffff',
      buttonHover: '#b91c1c',
      selected: '#fef2f2',
      hover: '#f1f5f9',
      focus: '#dc2626',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#dc2626',
      errorBg: '#fef2f2',
      info: '#dc2626',
      infoBg: '#fef2f2',
      badgeBg: '#fee2e2',
      badgeText: '#991b1b'
    },
    dark: {
      primary: '#ef4444',
      primaryVariant: '#dc2626',
      secondary: '#f87171',
      accent: '#fca5a5',
      background: '#170608',
      backgroundSecondary: '#240b0e',
      surface: '#331015',
      surfaceVariant: '#46171d',
      card: '#331015',
      cardBorder: '#5d1f27',
      textPrimary: '#fef2f2',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#6a232c',
      divider: '#46171d',
      icon: '#f87171',
      button: '#ef4444',
      buttonText: '#ffffff',
      buttonHover: '#dc2626',
      selected: '#46171d',
      hover: '#3b1319',
      focus: '#f87171',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#f87171',
      infoBg: '#7f1d1d',
      badgeBg: '#46171d',
      badgeText: '#fecdd3'
    }
  },
  teal: {
    id: 'teal',
    name: 'Nordic Teal',
    description: 'Clean Botanical Retail, Wellness & Scandi Living',
    primaryHex: '#0d9488',
    secondaryHex: '#14b8a6',
    accentHex: '#2dd4bf',
    light: {
      primary: '#0d9488',
      primaryVariant: '#0f766e',
      secondary: '#14b8a6',
      accent: '#2dd4bf',
      background: '#f2fbfb',
      backgroundSecondary: '#e4f7f6',
      surface: '#ffffff',
      surfaceVariant: '#f0fdfa',
      card: '#ffffff',
      cardBorder: '#ccfbf1',
      textPrimary: '#134e4a',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#0d9488',
      button: '#0d9488',
      buttonText: '#ffffff',
      buttonHover: '#0f766e',
      selected: '#f0fdfa',
      hover: '#f1f5f9',
      focus: '#0d9488',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#0d9488',
      infoBg: '#f0fdfa',
      badgeBg: '#ccfbf1',
      badgeText: '#115e59'
    },
    dark: {
      primary: '#14b8a6',
      primaryVariant: '#0d9488',
      secondary: '#2dd4bf',
      accent: '#5eead4',
      background: '#071615',
      backgroundSecondary: '#0c2321',
      surface: '#123330',
      surfaceVariant: '#194541',
      card: '#123330',
      cardBorder: '#215954',
      textPrimary: '#f0fdfa',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#25655f',
      divider: '#194541',
      icon: '#2dd4bf',
      button: '#14b8a6',
      buttonText: '#ffffff',
      buttonHover: '#0d9488',
      selected: '#194541',
      hover: '#153b37',
      focus: '#2dd4bf',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#2dd4bf',
      infoBg: '#134e4a',
      badgeBg: '#194541',
      badgeText: '#99f6e4'
    }
  },
  slate: {
    id: 'slate',
    name: 'Obsidian Slate',
    description: 'Minimalist Monochrome, Contemporary Architecture & Tech',
    primaryHex: '#334155',
    secondaryHex: '#475569',
    accentHex: '#64748b',
    light: {
      primary: '#334155',
      primaryVariant: '#1e293b',
      secondary: '#475569',
      accent: '#64748b',
      background: '#f5f7fa',
      backgroundSecondary: '#eaeff5',
      surface: '#ffffff',
      surfaceVariant: '#f8fafc',
      card: '#ffffff',
      cardBorder: '#e2e8f0',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#334155',
      button: '#1e293b',
      buttonText: '#ffffff',
      buttonHover: '#0f172a',
      selected: '#f1f5f9',
      hover: '#f1f5f9',
      focus: '#334155',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#334155',
      infoBg: '#f1f5f9',
      badgeBg: '#e2e8f0',
      badgeText: '#1e293b'
    },
    dark: {
      primary: '#94a3b8',
      primaryVariant: '#cbd5e1',
      secondary: '#64748b',
      accent: '#cbd5e1',
      background: '#090d16',
      backgroundSecondary: '#111726',
      surface: '#171f33',
      surfaceVariant: '#202b44',
      card: '#171f33',
      cardBorder: '#293757',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#32436b',
      divider: '#202b44',
      icon: '#cbd5e1',
      button: '#334155',
      buttonText: '#ffffff',
      buttonHover: '#475569',
      selected: '#202b44',
      hover: '#1c263d',
      focus: '#cbd5e1',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#94a3b8',
      infoBg: '#1e293b',
      badgeBg: '#202b44',
      badgeText: '#e2e8f0'
    }
  },
  rose: {
    id: 'rose',
    name: 'Ruby Rose',
    description: 'Floral, Confectionery, Cosmeceuticals & Lifestyle',
    primaryHex: '#e11d48',
    secondaryHex: '#f43f5e',
    accentHex: '#fb7185',
    light: {
      primary: '#e11d48',
      primaryVariant: '#be123c',
      secondary: '#f43f5e',
      accent: '#fb7185',
      background: '#fdf3f6',
      backgroundSecondary: '#fae4eb',
      surface: '#ffffff',
      surfaceVariant: '#fff1f2',
      card: '#ffffff',
      cardBorder: '#ffe4e6',
      textPrimary: '#4c0519',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#e11d48',
      button: '#e11d48',
      buttonText: '#ffffff',
      buttonHover: '#be123c',
      selected: '#fff1f2',
      hover: '#f1f5f9',
      focus: '#e11d48',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#e11d48',
      errorBg: '#fff1f2',
      info: '#e11d48',
      infoBg: '#fff1f2',
      badgeBg: '#ffe4e6',
      badgeText: '#9f1239'
    },
    dark: {
      primary: '#f43f5e',
      primaryVariant: '#e11d48',
      secondary: '#fb7185',
      accent: '#fda4af',
      background: '#19070e',
      backgroundSecondary: '#260c17',
      surface: '#361322',
      surfaceVariant: '#4b1b30',
      card: '#361322',
      cardBorder: '#62243f',
      textPrimary: '#fff1f2',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#6e2947',
      divider: '#4b1b30',
      icon: '#fb7185',
      button: '#f43f5e',
      buttonText: '#ffffff',
      buttonHover: '#e11d48',
      selected: '#4b1b30',
      hover: '#3e1728',
      focus: '#fb7185',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#fb7185',
      infoBg: '#881337',
      badgeBg: '#4b1b30',
      badgeText: '#fecdd3'
    }
  },
  indigo: {
    id: 'indigo',
    name: 'Royal Indigo',
    description: 'Enterprise, Electronics, Specialty Apparel & Premium Retail',
    primaryHex: '#4f46e5',
    secondaryHex: '#6366f1',
    accentHex: '#818cf8',
    light: {
      primary: '#4f46e5',
      primaryVariant: '#4338ca',
      secondary: '#6366f1',
      accent: '#818cf8',
      background: '#f4f5fd',
      backgroundSecondary: '#eaeafd',
      surface: '#ffffff',
      surfaceVariant: '#eef2ff',
      card: '#ffffff',
      cardBorder: '#e0e7ff',
      textPrimary: '#1e1b4b',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#4f46e5',
      button: '#4f46e5',
      buttonText: '#ffffff',
      buttonHover: '#4338ca',
      selected: '#eef2ff',
      hover: '#f1f5f9',
      focus: '#4f46e5',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#4f46e5',
      infoBg: '#eef2ff',
      badgeBg: '#e0e7ff',
      badgeText: '#3730a3'
    },
    dark: {
      primary: '#6366f1',
      primaryVariant: '#4f46e5',
      secondary: '#818cf8',
      accent: '#a5b4fc',
      background: '#0c0e22',
      backgroundSecondary: '#131735',
      surface: '#1b204a',
      surfaceVariant: '#252c65',
      card: '#1b204a',
      cardBorder: '#323b86',
      textPrimary: '#eef2ff',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#394399',
      divider: '#252c65',
      icon: '#818cf8',
      button: '#6366f1',
      buttonText: '#ffffff',
      buttonHover: '#4f46e5',
      selected: '#252c65',
      hover: '#1f2555',
      focus: '#818cf8',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#818cf8',
      infoBg: '#312e81',
      badgeBg: '#252c65',
      badgeText: '#c7d2fe'
    }
  },
  custom: {
    id: 'custom',
    name: 'Custom Brand Palette',
    description: 'User-configured brand identity with automated WCAG contrast safety',
    primaryHex: '#0284c7',
    secondaryHex: '#0ea5e9',
    accentHex: '#38bdf8',
    light: {
      primary: '#0284c7',
      primaryVariant: '#0369a1',
      secondary: '#0ea5e9',
      accent: '#38bdf8',
      background: '#f3f8fc',
      backgroundSecondary: '#e6f1f9',
      surface: '#ffffff',
      surfaceVariant: '#f0f9ff',
      card: '#ffffff',
      cardBorder: '#e0f2fe',
      textPrimary: '#082f49',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: '#0284c7',
      button: '#0284c7',
      buttonText: '#ffffff',
      buttonHover: '#0369a1',
      selected: '#f0f9ff',
      hover: '#f1f5f9',
      focus: '#0284c7',
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: '#0284c7',
      infoBg: '#f0f9ff',
      badgeBg: '#e0f2fe',
      badgeText: '#075985'
    },
    dark: {
      primary: '#38bdf8',
      primaryVariant: '#0284c7',
      secondary: '#7dd3fc',
      accent: '#bae6fd',
      background: '#081420',
      backgroundSecondary: '#0d2033',
      surface: '#132d47',
      surfaceVariant: '#1a3e61',
      card: '#132d47',
      cardBorder: '#23527f',
      textPrimary: '#f0f9ff',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#296096',
      divider: '#1a3e61',
      icon: '#7dd3fc',
      button: '#0284c7',
      buttonText: '#ffffff',
      buttonHover: '#0369a1',
      selected: '#1a3e61',
      hover: '#163554',
      focus: '#7dd3fc',
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: '#38bdf8',
      infoBg: '#075985',
      badgeBg: '#1a3e61',
      badgeText: '#bae6fd'
    }
  },
  'premium-dark': {
    id: 'premium-dark',
    name: 'Premium Dark',
    description: 'Fine Dining, Craft Cocktail Bars & Luxury Boutique POS',
    primaryHex: '#f59e0b',
    secondaryHex: '#d97706',
    accentHex: '#fbbf24',
    light: fillTokens({
      primary: '#d97706',
      primaryContainer: '#fef3c7',
      primaryVariant: '#b45309',
      secondary: '#b45309',
      secondaryContainer: '#fde68a',
      accent: '#f59e0b',
      background: '#f8f7f5',
      backgroundSecondary: '#f0ede8',
      surface: '#ffffff',
      surfaceVariant: '#fdfbf7',
      card: '#ffffff',
      cardSelected: '#fef3c7',
      cardBorder: '#e7e2d9',
      textPrimary: '#1c1917',
      textSecondary: '#57534e',
      textDisabled: '#a8a29e',
      border: '#d6d3d1',
      divider: '#e7e5e4',
      icon: '#d97706',
      button: '#d97706',
      buttonPrimary: '#d97706',
      buttonSecondary: '#78350f',
      buttonText: '#ffffff',
      buttonHover: '#b45309',
      selected: '#fef3c7',
      hover: '#f5f5f4',
      focus: '#d97706'
    }),
    dark: fillTokens({
      primary: '#f59e0b',
      primaryContainer: '#451a03',
      primaryVariant: '#d97706',
      secondary: '#fbbf24',
      secondaryContainer: '#78350f',
      accent: '#fde68a',
      background: '#0d0f12',
      backgroundSecondary: '#15181e',
      surface: '#181c24',
      surfaceVariant: '#222834',
      card: '#181c24',
      cardSelected: '#2a3344',
      cardBorder: '#2e3748',
      textPrimary: '#fafaf9',
      textSecondary: '#a8a29e',
      textDisabled: '#78716c',
      border: '#3b475d',
      divider: '#222834',
      icon: '#fbbf24',
      button: '#f59e0b',
      buttonPrimary: '#f59e0b',
      buttonSecondary: '#d97706',
      buttonText: '#000000',
      buttonHover: '#fbbf24',
      selected: '#222834',
      hover: '#1d232f',
      focus: '#fbbf24'
    })
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'WCAG AAA Ultra-Legibility for Outdoor & Low-Vision POS',
    primaryHex: '#000000',
    secondaryHex: '#1e293b',
    accentHex: '#0284c7',
    light: fillTokens({
      primary: '#000000',
      primaryContainer: '#e2e8f0',
      primaryVariant: '#1e293b',
      secondary: '#1e293b',
      secondaryContainer: '#cbd5e1',
      accent: '#0369a1',
      background: '#ffffff',
      backgroundSecondary: '#f8fafc',
      surface: '#ffffff',
      surfaceVariant: '#f1f5f9',
      card: '#ffffff',
      cardSelected: '#e2e8f0',
      cardBorder: '#000000',
      textPrimary: '#000000',
      textSecondary: '#0f172a',
      textDisabled: '#64748b',
      border: '#000000',
      divider: '#000000',
      icon: '#000000',
      button: '#000000',
      buttonPrimary: '#000000',
      buttonSecondary: '#1e293b',
      buttonText: '#ffffff',
      buttonHover: '#334155',
      selected: '#e2e8f0',
      hover: '#f1f5f9',
      focus: '#000000'
    }),
    dark: fillTokens({
      primary: '#ffffff',
      primaryContainer: '#1e293b',
      primaryVariant: '#f8fafc',
      secondary: '#f1f5f9',
      secondaryContainer: '#334155',
      accent: '#38bdf8',
      background: '#000000',
      backgroundSecondary: '#0a0a0a',
      surface: '#0a0a0a',
      surfaceVariant: '#171717',
      card: '#0a0a0a',
      cardSelected: '#262626',
      cardBorder: '#ffffff',
      textPrimary: '#ffffff',
      textSecondary: '#f8fafc',
      textDisabled: '#94a3b8',
      border: '#ffffff',
      divider: '#ffffff',
      icon: '#ffffff',
      button: '#ffffff',
      buttonPrimary: '#ffffff',
      buttonSecondary: '#e2e8f0',
      buttonText: '#000000',
      buttonHover: '#f8fafc',
      selected: '#262626',
      hover: '#171717',
      focus: '#ffffff'
    })
  }
};

// -------------------------------------------------------------
// WCAG 2.1 Contrast & Color Utilities (Requirement 10)
// -------------------------------------------------------------

/**
 * Converts 3 or 6 digit hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Calculates relative luminance for a color
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

/**
 * Calculates WCAG contrast ratio between two colors (e.g. 4.5:1, 7:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  try {
    const lum1 = getRelativeLuminance(hex1);
    const lum2 = getRelativeLuminance(hex2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return Math.round(ratio * 100) / 100;
  } catch {
    return 4.5;
  }
}

/**
 * Validates a custom palette combination against WCAG AA standards
 */
export function validateContrast(
  foregroundHex: string,
  backgroundHex: string
): {
  ratio: number;
  isAA: boolean;
  isAAA: boolean;
  warning?: string;
  recommendedColor?: string;
} {
  const ratio = getContrastRatio(foregroundHex, backgroundHex);
  const isAA = ratio >= 4.5;
  const isAAA = ratio >= 7.0;

  let warning: string | undefined;
  let recommendedColor: string | undefined;

  if (!isAA) {
    warning = `Low contrast (${ratio}:1). WCAG AA requires at least 4.5:1 for standard text and interactive controls.`;
    // Suggest an adjusted version
    const bgLum = getRelativeLuminance(backgroundHex);
    recommendedColor = bgLum > 0.5 ? '#1e293b' : '#ffffff';
  }

  return {
    ratio,
    isAA,
    isAAA,
    warning,
    recommendedColor
  };
}

/**
 * Build a dynamic custom palette definition given user primary & secondary hex
 */
export function buildCustomPalette(
  custom: CustomThemeColors
): ThemePaletteDefinition {
  const primary = custom.primary || '#0284c7';
  const secondary = custom.secondary || '#0ea5e9';
  const accent = custom.accent || '#38bdf8';
  const bgTint = custom.bgTint || '#f3f8fc';

  // Determine if light text is needed on primary button
  const buttonTextColor = getContrastRatio('#ffffff', primary) >= 4.0 ? '#ffffff' : '#0f172a';

  return {
    id: 'custom',
    name: 'Custom Brand Palette',
    description: 'Customized business brand colors with WCAG accessibility validation',
    primaryHex: primary,
    secondaryHex: secondary,
    accentHex: accent,
    light: {
      primary,
      primaryVariant: secondary,
      secondary,
      accent,
      background: bgTint,
      backgroundSecondary: '#eaf1f8',
      surface: '#ffffff',
      surfaceVariant: '#f0f7fd',
      card: '#ffffff',
      cardBorder: '#dbeafe',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textDisabled: '#94a3b8',
      border: '#cbd5e1',
      divider: '#e2e8f0',
      icon: primary,
      button: primary,
      buttonText: buttonTextColor,
      buttonHover: secondary,
      selected: '#f0f7fd',
      hover: '#f1f5f9',
      focus: primary,
      success: '#10b981',
      successBg: '#ecfdf5',
      warning: '#f59e0b',
      warningBg: '#fffbeb',
      error: '#ef4444',
      errorBg: '#fef2f2',
      info: primary,
      infoBg: '#f0f7fd',
      badgeBg: '#dbeafe',
      badgeText: '#1e40af'
    },
    dark: {
      primary: accent,
      primaryVariant: primary,
      secondary,
      accent,
      background: '#090e1a',
      backgroundSecondary: '#11182c',
      surface: '#151e36',
      surfaceVariant: '#1e2a4a',
      card: '#151e36',
      cardBorder: '#25355e',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textDisabled: '#64748b',
      border: '#2c3e6d',
      divider: '#1e2a4a',
      icon: accent,
      button: primary,
      buttonText: buttonTextColor,
      buttonHover: secondary,
      selected: '#1e2a4a',
      hover: '#19233e',
      focus: accent,
      success: '#34d399',
      successBg: '#064e3b',
      warning: '#fbbf24',
      warningBg: '#78350f',
      error: '#f87171',
      errorBg: '#7f1d1d',
      info: accent,
      infoBg: '#1e3a8a',
      badgeBg: '#1e2a4a',
      badgeText: '#93c5fd'
    }
  };
}

// -------------------------------------------------------------
// Centralized ThemeManager Service (Requirement 1 & 19)
// -------------------------------------------------------------
export class ThemeService {
  private static systemListenerAttached = false;
  private static cachedActiveTokens: SemanticColorTokens | null = null;

  /**
   * Resolves active system mode ('light' or 'dark')
   */
  static resolveEffectiveMode(mode: ThemeMode = 'light'): 'light' | 'dark' {
    if (mode === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    return mode;
  }

  /**
   * Gets the active semantic color tokens for the given appearance settings
   */
  static getTokens(appearance: AppearanceSettings): SemanticColorTokens {
    const effectiveMode = this.resolveEffectiveMode(appearance.mode);
    const paletteDef =
      appearance.palette === 'custom' && appearance.customColors
        ? buildCustomPalette(appearance.customColors)
        : THEME_PALETTES[appearance.palette] || THEME_PALETTES.blue;

    const raw = effectiveMode === 'dark' ? paletteDef.dark : paletteDef.light;
    return fillTokens(raw);
  }

  /**
   * Applies the theme settings to the HTML DOM root element
   */
  static applyToDOM(
    appearance: AppearanceSettings,
    settings?: Partial<StoreSettings>
  ): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const effectiveMode = this.resolveEffectiveMode(appearance.mode);
    const tokens = this.getTokens(appearance);
    this.cachedActiveTokens = tokens;

    // 1. Data attributes on <html>
    root.setAttribute('data-theme', appearance.palette);
    root.setAttribute('data-mode', effectiveMode);
    root.setAttribute('data-bg-style', appearance.backgroundStyle);
    root.setAttribute('data-bg-pattern', appearance.pattern || 'none');

    if (effectiveMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 2. Inject Semantic Theme CSS Variables
    root.style.setProperty('--theme-primary', tokens.primary);
    root.style.setProperty('--theme-primary-container', tokens.primaryContainer);
    root.style.setProperty('--theme-primary-variant', tokens.primaryVariant);
    root.style.setProperty('--theme-secondary', tokens.secondary);
    root.style.setProperty('--theme-secondary-container', tokens.secondaryContainer);
    root.style.setProperty('--theme-accent', tokens.accent);

    // Background & Surfaces
    root.style.setProperty('--theme-bg', tokens.background);
    root.style.setProperty('--theme-bg-secondary', tokens.backgroundSecondary);
    root.style.setProperty('--theme-surface', tokens.surface);
    root.style.setProperty('--theme-surface-variant', tokens.surfaceVariant);
    root.style.setProperty('--theme-card', tokens.card);
    root.style.setProperty('--theme-card-selected', tokens.cardSelected);
    root.style.setProperty('--theme-card-border', tokens.cardBorder);

    // Typography
    root.style.setProperty('--theme-text-primary', tokens.textPrimary);
    root.style.setProperty('--theme-text-secondary', tokens.textSecondary);
    root.style.setProperty('--theme-text-disabled', tokens.textDisabled);

    // Borders & Lines
    root.style.setProperty('--theme-border', tokens.border);
    root.style.setProperty('--theme-divider', tokens.divider);
    root.style.setProperty('--theme-icon', tokens.icon);

    // Buttons & Interactivity
    root.style.setProperty('--theme-button', tokens.button);
    root.style.setProperty('--theme-button-primary', tokens.buttonPrimary);
    root.style.setProperty('--theme-button-secondary', tokens.buttonSecondary);
    root.style.setProperty('--theme-button-text', tokens.buttonText);
    root.style.setProperty('--theme-button-hover', tokens.buttonHover);
    root.style.setProperty('--theme-selected', tokens.selected);
    root.style.setProperty('--theme-hover', tokens.hover);
    root.style.setProperty('--theme-focus', tokens.focus);

    // Semantic Status Tokens
    root.style.setProperty('--theme-status-success', tokens.success);
    root.style.setProperty('--theme-status-warning', tokens.warning);
    root.style.setProperty('--theme-status-error', tokens.error);
    root.style.setProperty('--theme-status-info', tokens.info);
    root.style.setProperty('--theme-status-offline', tokens.offline);
    root.style.setProperty('--theme-status-online', tokens.online);
    root.style.setProperty('--theme-status-pending', tokens.pending);

    // 3. Backward-compatible Tailwind primary color mappings
    root.style.setProperty('--color-primary', tokens.primary);
    root.style.setProperty('--color-blue-50', tokens.surfaceVariant);
    root.style.setProperty('--color-blue-100', tokens.cardBorder);
    root.style.setProperty('--color-blue-200', tokens.border);
    root.style.setProperty('--color-blue-500', tokens.secondary);
    root.style.setProperty('--color-blue-600', tokens.primary);
    root.style.setProperty('--color-blue-700', tokens.primaryVariant);
    root.style.setProperty('--color-blue-800', tokens.primaryVariant);
    root.style.setProperty('--color-blue-900', tokens.textPrimary);

    // 4. Attach OS theme listener if 'system' mode is selected
    if (typeof window !== 'undefined' && window.matchMedia && !this.systemListenerAttached) {
      this.systemListenerAttached = true;
      try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => {
          if (appearance.mode === 'system') {
            this.applyToDOM(appearance, settings);
          }
        };
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', listener);
        } else if ((mediaQuery as any).addListener) {
          (mediaQuery as any).addListener(listener);
        }
      } catch (e) {
        console.warn('System appearance listener error:', e);
      }
    }
  }

  /**
   * Formats StoreSettings into AppearanceSettings object
   */
  static extractAppearance(settings: Partial<StoreSettings>): AppearanceSettings {
    const palette = (settings.themePalette || settings.themeColor || 'emerald') as ThemePaletteId;
    return {
      mode: (settings.themeMode || 'light') as ThemeMode,
      palette: THEME_PALETTES[palette] ? palette : 'emerald',
      backgroundStyle: (settings.themeBackgroundStyle || 'soft-tint') as BackgroundStyle,
      pattern: (settings.themePattern || 'none') as PatternStyle,
      accentColor: settings.themeAccentColor,
      customColors: settings.themeCustomColors
    };
  }
}
