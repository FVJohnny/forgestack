import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale, type Locale } from './i18n/config';

const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check if we have a locale cookie
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value as Locale | undefined;

  if (cookieLocale && locales.includes(cookieLocale)) {
    // Cookie exists and is valid - ensure it's passed through
    return response;
  }

  // No valid cookie - check Accept-Language header and set a default cookie
  const acceptLanguage = request.headers.get('Accept-Language');
  let locale: Locale = defaultLocale;

  if (acceptLanguage) {
    const preferredLocale = acceptLanguage.split(',')[0].split('-')[0] as Locale;
    if (locales.includes(preferredLocale)) {
      locale = preferredLocale;
    }
  }

  // Set the cookie for future requests
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    maxAge: 31536000, // 1 year
    sameSite: 'lax',
  });

  return response;
}

export const config = {
  // Match all paths except static files and API routes
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
