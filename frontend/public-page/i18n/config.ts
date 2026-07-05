export const locales = ['en', 'es', 'pt', 'de', 'fr', 'nl', 'pl', 'th'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/**
 * Pick the best supported locale from an Accept-Language header. Walks the
 * whole q-sorted list, so `ca,es;q=0.9` matches `es` instead of falling back
 * to the default just because the first tag is unsupported. Returns null when
 * nothing matches.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;

  const candidates = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((c) => c.tag && c.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    const base = tag.split('-')[0] as Locale;
    if (locales.includes(base)) return base;
  }
  return null;
}

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
