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
