/**
 * AuraPOS Centralized Internationalization (i18n) Core Architecture
 * Canonical Source of Truth for Supported Languages & Locales
 */

import { en, TranslationKey } from './locales/en.ts';
import { es } from './locales/es.ts';
import { fr } from './locales/fr.ts';
import { de } from './locales/de.ts';
import { ar } from './locales/ar.ts';
import { he } from './locales/he.ts';
import { zh } from './locales/zh.ts';
import { ja } from './locales/ja.ts';
import { pt } from './locales/pt.ts';
import {
  CATEGORY_TRANSLATIONS,
  PRODUCT_TRANSLATIONS,
  COMMON_EXTRA_TRANSLATIONS
} from './catalogTranslations.ts';

export type { TranslationKey };

export type SupportedLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'ar'
  | 'he'
  | 'zh'
  | 'ja'
  | 'pt';

export interface LocaleMetadata {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
  dir: 'ltr' | 'rtl';
  localeCode: string;
}

/**
 * Canonical Source of Truth for Supported Languages across AuraPOS.
 * Any new language must be declared here and have a corresponding dictionary in /locales.
 */
export const SUPPORTED_LOCALES: readonly LocaleMetadata[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'en-US'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'es-ES'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'fr-FR'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'de-DE'
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    direction: 'rtl',
    dir: 'rtl',
    localeCode: 'ar-SA'
  },
  {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    flag: '🇮🇱',
    direction: 'rtl',
    dir: 'rtl',
    localeCode: 'he-IL'
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '简体中文',
    flag: '🇨🇳',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'zh-CN'
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'ja-JP'
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    direction: 'ltr',
    dir: 'ltr',
    localeCode: 'pt-BR'
  }
] as const;

// Alias for backwards compatibility
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES;

/**
 * All Locale Translation Dictionaries
 */
export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en,
  es,
  fr,
  de,
  ar,
  he,
  zh,
  ja,
  pt
};

/**
 * Helper to get locale metadata
 */
export function getLocaleMetadata(lang: SupportedLanguage): LocaleMetadata {
  return (
    SUPPORTED_LOCALES.find(l => l.code === lang) || SUPPORTED_LOCALES[0]
  );
}

/**
 * Centralized Translation Function with Dev-time missing key warning
 * and variable interpolation: t('key', 'fallback', { count: 5 })
 */
export function translate(
  lang: SupportedLanguage,
  key: string,
  fallbackOrParams?: string | Record<string, string | number>,
  params?: Record<string, string | number>
): string {
  let fallback: string | undefined;
  let variables: Record<string, string | number> | undefined;

  if (typeof fallbackOrParams === 'string') {
    fallback = fallbackOrParams;
    variables = params;
  } else if (typeof fallbackOrParams === 'object' && fallbackOrParams !== null) {
    variables = fallbackOrParams;
  }

  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const extra = COMMON_EXTRA_TRANSLATIONS[lang] || COMMON_EXTRA_TRANSLATIONS.en;

  let text = dict[key] || extra[key];

  if (!text) {
    // Missing translation detection in development
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn(`[i18n] Missing translation for key: "${key}" in language "${lang}"`);
    }

    // Fall back to English or user fallback
    text = TRANSLATIONS.en[key] || COMMON_EXTRA_TRANSLATIONS.en[key] || fallback || key;
  }

  // Variable interpolation: replace {name}, {count}, etc.
  if (variables && Object.keys(variables).length > 0) {
    Object.entries(variables).forEach(([k, val]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val));
    });
  }

  return text;
}

/**
 * Locale-Aware Currency Formatter using Intl.NumberFormat
 */
export function formatLocaleCurrency(
  amount: number,
  currencySymbol = '$',
  lang: SupportedLanguage = 'en'
): string {
  const meta = getLocaleMetadata(lang);
  try {
    const formatted = new Intl.NumberFormat(meta.localeCode, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

    return `${currencySymbol}${formatted}`;
  } catch {
    return `${currencySymbol}${amount.toFixed(2)}`;
  }
}

/**
 * Locale-Aware Date Formatter using Intl.DateTimeFormat
 */
export function formatLocaleDate(
  dateValue: string | Date | number,
  lang: SupportedLanguage = 'en',
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }
): string {
  const meta = getLocaleMetadata(lang);
  try {
    const date = typeof dateValue === 'string' || typeof dateValue === 'number'
      ? new Date(dateValue)
      : dateValue;
    return new Intl.DateTimeFormat(meta.localeCode, options).format(date);
  } catch {
    return String(dateValue);
  }
}

/**
 * Locale-Aware Time Formatter using Intl.DateTimeFormat
 */
export function formatLocaleTime(
  dateValue: string | Date | number,
  lang: SupportedLanguage = 'en',
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  const meta = getLocaleMetadata(lang);
  try {
    const date = typeof dateValue === 'string' || typeof dateValue === 'number'
      ? new Date(dateValue)
      : dateValue;
    return new Intl.DateTimeFormat(meta.localeCode, options).format(date);
  } catch {
    return String(dateValue);
  }
}

/**
 * Locale-Aware Number Formatter using Intl.NumberFormat
 */
export function formatLocaleNumber(
  value: number,
  lang: SupportedLanguage = 'en',
  options?: Intl.NumberFormatOptions
): string {
  const meta = getLocaleMetadata(lang);
  try {
    return new Intl.NumberFormat(meta.localeCode, options).format(value);
  } catch {
    return String(value);
  }
}

export {
  CATEGORY_TRANSLATIONS,
  PRODUCT_TRANSLATIONS,
  COMMON_EXTRA_TRANSLATIONS
};
