import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

type Messages = Record<string, unknown>;

/** Deep-merge `override` onto `base`, so any key missing from a locale falls
 *  back to the default-locale (English) value instead of rendering the raw key. */
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function loadMessages(locale: Locale): Promise<Messages> {
  const base = (await import(`../messages/${defaultLocale}.json`)).default as Messages;
  if (locale === defaultLocale) return base;
  try {
    const localeMessages = (await import(`../messages/${locale}.json`)).default as Messages;
    // English is the source of truth; each locale overrides only what it translates.
    return deepMerge(base, localeMessages);
  } catch {
    return base;
  }
}

export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;

  // Fallback to Accept-Language header
  let locale: Locale = defaultLocale;

  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const headersList = await headers();
    const acceptLanguage = headersList.get('Accept-Language');
    if (acceptLanguage) {
      const preferredLocale = acceptLanguage.split(',')[0].split('-')[0] as Locale;
      if (locales.includes(preferredLocale)) {
        locale = preferredLocale;
      }
    }
  }

  return {
    locale,
    messages: await loadMessages(locale),
    // Use UTC timezone to ensure consistent time handling across server and client
    timeZone: 'UTC',
  };
});
