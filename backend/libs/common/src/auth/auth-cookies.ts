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
    // always valid.
    secure: true,
    // The frontend and both APIs are served under path prefixes on the SAME
    // origin (Caddy routes https://<host>/svc1/* to service-1, /svc2/* to
    // service-2, everything else to the frontend). A fetch from the app to the
    // API is therefore same-origin, so SameSite=Lax attaches the cookies on its
    // own and no shared parent Domain is needed. This also avoids the dev trap
    // where a cross-site setup needed Domain=.localhost, which every browser
    // rejects as an invalid cookie domain.
    //
    // Lax means the browser will not attach these cookies to a cross-site
    // request a malicious page forges, so it is a real (if secondary) CSRF
    // defense on top of the Sec-Fetch-Site / Origin check in csrf.middleware.ts.
    sameSite: 'lax' as const,
    path: '/',
    // Host-only cookie: no Domain attribute. Same-origin routing means the one
    // host that sets the cookie is the same host every API call goes to.
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
