import type { Response } from 'express';

/**
 * httpOnly cookie names for the auth tokens. The browser never reads these
 * values (that is the point: it keeps them out of reach of XSS), it just
 * sends them back automatically.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Access tokens are short-lived; refresh tokens live longer. These are upper
// bounds for the cookie itself — the JWT `exp` is still the real authority,
// the guard rejects an expired token regardless of cookie lifetime.
const ACCESS_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function baseCookieOptions() {
  return {
    httpOnly: true,
    // Both dev and prod serve everything over HTTPS through Caddy, so Secure is
    // always valid. It is also REQUIRED here: SameSite=None cookies are
    // rejected by browsers unless Secure is set.
    secure: true,
    // The frontend (e.g. https://localhost, https://app.example.com) and the
    // API (https://service1.localhost, https://service1.example.com) are on
    // DIFFERENT hosts, so a fetch from the app to the API is cross-site. With
    // SameSite=Lax the browser would not attach these cookies to that fetch
    // (Lax only covers top-level navigations), which made login succeed but
    // the follow-up /auth/me get a 401. SameSite=None lets the cookies ride
    // cross-site requests; CSRF is mitigated because the tokens are httpOnly
    // and the API also validates them against the token store.
    sameSite: 'none' as const,
    path: '/',
  };
}

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  const opts = baseCookieOptions();
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...opts,
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...opts,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  const opts = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, opts);
  res.clearCookie(REFRESH_TOKEN_COOKIE, opts);
}
