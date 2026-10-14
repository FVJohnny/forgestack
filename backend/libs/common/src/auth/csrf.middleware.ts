import type { NextFunction, Request, Response } from 'express';

import { CorrelationLogger } from '../logger';

/**
 * CSRF protection for cookie-authenticated requests.
 *
 * The auth tokens live in `SameSite=Lax` cookies. The frontend and both APIs
 * are served under path prefixes on the same origin (Caddy routes /svc1/* and
 * /svc2/* to the services, everything else to the frontend), so the app's own
 * fetches are same-origin and Lax attaches the cookie on its own. Lax already
 * blocks most cross-site forgeries, but not all (a top-level GET navigation
 * still carries the cookie), so this middleware is defense in depth.
 *
 * It rejects state-changing requests (anything other than GET/HEAD/OPTIONS)
 * that are cross-site. "Cross-site" is decided by:
 *
 *   1. The `Origin` header, when present: it must be in the allowlist
 *      (CORS_ORIGINS) or match the request's own host. Anything else is a
 *      cross-site forgery attempt and is rejected.
 *   2. Otherwise `Sec-Fetch-Site` (sent by all current browsers): only
 *      `same-origin`, `same-site`, and `none` (a user-initiated navigation, no
 *      initiator site) are allowed; `cross-site` is rejected.
 *   3. A request with neither header is allowed, since a browser fetch always
 *      sends at least one and a server-to-server client is not a CSRF vector.
 *
 * This allows the same-origin frontend while blocking a forged `<form>` post
 * from an attacker page, without needing a CSRF token round-trip in the client.
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

    const block = () => {
      logger.warn(`Blocked cross-site ${req.method} ${req.path}`);
      res.status(403).json({
        success: false,
        error: { code: 'CSRF_BLOCKED', message: 'Cross-site request blocked' },
      });
    };

    // An allowlisted Origin or a same-host request is trusted. With same-origin
    // routing the app's own calls carry `Origin: <the app host>`, which matches
    // the request host, so they pass here. The CORS_ORIGINS allowlist still
    // covers any additional trusted origin. It is the Origin (not the raw site
    // relationship) that separates a trusted caller from an attacker page.
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      const normalized = normalizeOrigin(origin);
      const sameHost = normalizeOrigin(`${req.protocol}://${req.get('host') ?? ''}`);
      if (allowedOrigins.has(normalized) || normalized === sameHost) {
        next();
        return;
      }
      // Origin present but not allowlisted: a cross-site forgery attempt.
      block();
      return;
    }

    // No Origin header. Use Sec-Fetch-Site when present: a same-origin/same-site
    // request (or a user-initiated navigation, `none`) is fine; `cross-site`
    // with no Origin is suspicious, so block it.
    const secFetchSite = req.headers['sec-fetch-site'];
    if (typeof secFetchSite === 'string') {
      if (secFetchSite === 'cross-site') {
        block();
        return;
      }
      next();
      return;
    }

    // No Origin and no Sec-Fetch-Site: not a browser-forgeable request
    // (server-to-server clients set neither), so allow it.
    next();
  };
}
