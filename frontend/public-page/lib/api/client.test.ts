import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, APIError } from './client';
import { API_ENDPOINTS } from './config';

// Item 192: the API client had no tests. These cover the parts a forker relies
// on and would break by accident: response parsing, error mapping into
// APIError, and the one-shot 401 refresh-and-retry flow. fetch is stubbed.

const jsonResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
  json: async () => body,
});

describe('APIClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses a JSON body on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: 'world' }));
    const result = await apiClient.get<{ hello: string }>('/thing');
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns an empty object for an empty body (204)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(undefined, { status: 204 }));
    const result = await apiClient.get('/thing');
    expect(result).toEqual({});
  });

  it('throws an APIError with status and data on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Boom' } }, { ok: false, status: 500 }),
    );
    // 500 on a non-auth path: no refresh attempt, straight throw.
    await expect(apiClient.get('/thing')).rejects.toMatchObject({
      name: 'APIError',
      status: 500,
      message: 'Boom',
    });
  });

  it('sends credentials with every request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await apiClient.get('/thing');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/thing'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('on a 401 refreshes once and retries the original request', async () => {
    fetchMock
      // 1) original request -> 401
      .mockResolvedValueOnce(jsonResponse({ message: 'nope' }, { ok: false, status: 401 }))
      // 2) refresh -> ok
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      // 3) retried original -> success
      .mockResolvedValueOnce(jsonResponse({ data: 'ok' }));

    const result = await apiClient.get<{ data: string }>('/protected');

    expect(result).toEqual({ data: 'ok' });
    const refreshCalled = fetchMock.mock.calls.some(([url]) =>
      String(url).includes(API_ENDPOINTS.AUTH.REFRESH),
    );
    expect(refreshCalled).toBe(true);
  });

  it('dispatches auth:unauthenticated when the refresh fails', async () => {
    const dispatch = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatch, CustomEvent });

    fetchMock
      // original -> 401
      .mockResolvedValueOnce(jsonResponse({ message: 'nope' }, { ok: false, status: 401 }))
      // refresh -> fails
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }));

    await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(APIError);
    expect(dispatch).toHaveBeenCalled();
  });
});
