import type { NextFunction, Request, Response } from 'express';

import { CorrelationLogger } from '../logger';

/**
 * CSRF protection for cookie-authenticated requests.
 *
 * The auth tokens live in `SameSite=None` cookies (required because in dev the
 * frontend at https://localhost and the API at https://service1.localhost are
 * different sites, so `Lax` would not attach the cookie to the app's fetch).
 * `SameSite=None` means the browser attaches those cookies to EVERY cross-site
 * request, including ones a malicious page forges, so `SameSite` alone is no
 * longer a CSRF defense. httpOnly does not help either: a forged request never
 * needs to read the cookie, the browser sends it automatically.
 *
 * This middleware closes that hole by rejecting state-changing requests
 * (anything other than GET/HEAD/OPTIONS) that are cross-site. "Cross-site" is
 * decided by:
 *
 *   1. `Sec-Fetch-Site` when present (sent by all current browsers): only
 *      `same-origin`, `same-site`, and `none` (a user-initiated navigation, no
 *      initiator site) are allowed. `cross-site` is rejected.
 *   2. Otherwise the `Origin` header must be in the allowlist (CORS_ORIGINS)
 *      or match the request's own host. A request with neither header is
 *      allowed, since a browser fetch always sends at least one and a
 *      server-to-server client is not a CSRF vector.
 *
 * This preserves the legitimate cross-site frontend (its Origin is in
 * CORS_ORIGINS) while blocking a forged `<form>` post from an attacker page,
 * without needing a CSRF token round-trip in the client.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function createCsrfMiddleware() {
  const logger = new CorrelationLogger('CsrfMiddleware');
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean),
  );

  return function csrfGuard(req: Request, res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const secFetchSite = req.headers['sec-fetch-site'];
    if (typeof secFetchSite === 'string') {
      if (secFetchSite === 'cross-site') {
        logger.warn(`Blocked cross-site ${req.method} ${req.path} (Sec-Fetch-Site)`);
        res.status(403).json({
          success: false,
          error: { code: 'CSRF_BLOCKED', message: 'Cross-site request blocked' },
        });
        return;
      }
      // same-origin / same-site / none are all trusted.
      next();
      return;
    }

    // Older client with no Sec-Fetch-Site: fall back to Origin.
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      const normalized = normalizeOrigin(origin);
      const sameHost = normalizeOrigin(`${req.protocol}://${req.get('host') ?? ''}`);
      if (allowedOrigins.has(normalized) || normalized === sameHost) {
        next();
        return;
      }
      logger.warn(`Blocked cross-site ${req.method} ${req.path} (Origin: ${origin})`);
      res.status(403).json({
        success: false,
        error: { code: 'CSRF_BLOCKED', message: 'Cross-site request blocked' },
      });
      return;
    }

    // No Origin and no Sec-Fetch-Site: not a browser-forgeable request
    // (server-to-server clients set neither), so allow it.
    next();
  };
}
