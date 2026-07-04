import type { Request, Response } from 'express';

/**
 * httpOnly cookie names for the auth tokens. The browser never reads these
 * values (that is the point: it keeps them out of reach of XSS), it just
 * sends them back automatically. During impersonation the admin's own tokens
 * are stacked under the `admin_*` names so they can be restored afterwards.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const ADMIN_ACCESS_TOKEN_COOKIE = 'admin_access_token';
export const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';

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
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // Secure everywhere except plain-http local dev, where the browser would
    // drop a Secure cookie sent over http://localhost.
    secure: isProduction,
    // 'lax' lets top-level navigations carry the cookie (e.g. returning from
    // an OAuth redirect) while still blocking most CSRF vectors. The API is
    // same-site with the frontend behind Caddy, so 'lax' is sufficient.
    sameSite: 'lax' as const,
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

/** Move the current auth cookies into the `admin_*` slots (start impersonation). */
export function stashAdminCookies(req: Request, res: Response): void {
  const opts = baseCookieOptions();
  const access = req.cookies?.[ACCESS_TOKEN_COOKIE];
  const refresh = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (access) {
    res.cookie(ADMIN_ACCESS_TOKEN_COOKIE, access, {
      ...opts,
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    });
  }
  if (refresh) {
    res.cookie(ADMIN_REFRESH_TOKEN_COOKIE, refresh, {
      ...opts,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }
}

/** Restore the stashed admin cookies into the active slots (stop impersonation). */
export function restoreAdminCookies(req: Request, res: Response): AuthTokens | null {
  const accessToken = req.cookies?.[ADMIN_ACCESS_TOKEN_COOKIE];
  const refreshToken = req.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE];
  if (!accessToken || !refreshToken) {
    return null;
  }
  setAuthCookies(res, { accessToken, refreshToken });
  clearAdminCookies(res);
  return { accessToken, refreshToken };
}

export function clearAdminCookies(res: Response): void {
  const opts = baseCookieOptions();
  res.clearCookie(ADMIN_ACCESS_TOKEN_COOKIE, opts);
  res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE, opts);
}

export function isImpersonating(req: Request): boolean {
  return Boolean(req.cookies?.[ADMIN_ACCESS_TOKEN_COOKIE]);
}
