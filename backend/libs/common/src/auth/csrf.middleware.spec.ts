import type { NextFunction, Request, Response } from 'express';

import { createCsrfMiddleware } from './csrf.middleware';

/**
 * Item 119: the auth cookies are SameSite=None, so a Sec-Fetch-Site / Origin
 * check is the CSRF defense. These lock in that state-changing cross-site
 * requests are rejected while the legitimate cross-site frontend and safe
 * methods pass.
 */
describe('csrf middleware', () => {
  const ORIGINAL = process.env.CORS_ORIGINS;

  beforeAll(() => {
    process.env.CORS_ORIGINS = 'https://localhost,https://app.example.com';
  });
  afterAll(() => {
    process.env.CORS_ORIGINS = ORIGINAL;
  });

  const run = (req: Partial<Request> & { headers?: Record<string, string> }) => {
    const mw = createCsrfMiddleware();
    const next = jest.fn() as unknown as NextFunction;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    mw(
      {
        method: 'POST',
        path: '/api/v1/auth/logout',
        protocol: 'https',
        get: (h: string) => (h.toLowerCase() === 'host' ? 'service1.localhost' : undefined),
        headers: {},
        ...req,
      } as unknown as Request,
      res,
      next,
    );
    return { next, res };
  };

  it('allows safe methods regardless of site', () => {
    const { next, res } = run({ method: 'GET', headers: { 'sec-fetch-site': 'cross-site' } });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks a cross-site state-changing request with no Origin', () => {
    const { next, res } = run({ headers: { 'sec-fetch-site': 'cross-site' } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('ALLOWS the allowlisted frontend even when Sec-Fetch-Site is cross-site', () => {
    // The real frontend calls the API cross-site (localhost -> service1.*), so
    // the browser sends Sec-Fetch-Site: cross-site with an allowlisted Origin.
    // This must pass, or the whole app is locked out (the bug this guards).
    const { next, res } = run({
      headers: { origin: 'https://app.example.com', 'sec-fetch-site': 'cross-site' },
    });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows same-origin / same-site via Sec-Fetch-Site (no Origin header)', () => {
    for (const site of ['same-origin', 'same-site', 'none']) {
      const { next, res } = run({ headers: { 'sec-fetch-site': site } });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it('allows an allowlisted Origin', () => {
    const { next, res } = run({ headers: { origin: 'https://app.example.com' } });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks a non-allowlisted (attacker) Origin', () => {
    const { next, res } = run({
      headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a request with neither header (server-to-server)', () => {
    const { next, res } = run({ headers: {} });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
