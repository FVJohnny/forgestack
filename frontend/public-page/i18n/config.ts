export const locales = ['en', 'es', 'pt', 'de', 'fr', 'nl', 'pl', 'th'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  fr: 'Français',
  nl: 'Nederlands',
  pl: 'Polski',
  th: 'ไทย',
};

// Emoji flags (fallback for display)
export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  pt: '🇧🇷',
  de: '🇩🇪',
  fr: '🇫🇷',
  nl: '🇳🇱',
  pl: '🇵🇱',
  th: '🇹🇭',
};

// Country codes for flag images (ISO 3166-1 alpha-2)
export const localeFlagCodes: Record<Locale, string> = {
  en: 'us',
  es: 'es',
  pt: 'br',
  de: 'de',
  fr: 'fr',
  nl: 'nl',
  pl: 'pl',
  th: 'th',
};
