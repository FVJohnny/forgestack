import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, APIError, service2ApiClient } from './client';
import { API_CONFIG, API_ENDPOINTS, SERVICE2_API_CONFIG } from './config';

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

  it('refreshes a service-2 401 through service-1 (the auth service)', async () => {
    fetchMock
      // 1) service-2 request -> 401
      .mockResolvedValueOnce(jsonResponse({ message: 'nope' }, { ok: false, status: 401 }))
      // 2) refresh -> ok
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      // 3) retried service-2 request -> success
      .mockResolvedValueOnce(jsonResponse({ data: 'tasks' }));

    const result = await service2ApiClient.get<{ data: string }>('/tasks');

    expect(result).toEqual({ data: 'tasks' });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    // service-2 has no refresh endpoint: refreshing against its base URL 404s
    // and logs the user out.
    expect(urls[1]).toBe(`${API_CONFIG.baseURL}${API_ENDPOINTS.AUTH.REFRESH}`);
    expect(urls[1].startsWith(SERVICE2_API_CONFIG.baseURL)).toBe(false);
    expect(urls[2]).toBe(`${SERVICE2_API_CONFIG.baseURL}/tasks`);
  });

  it('shares one in-flight refresh across the service-1 and service-2 clients', async () => {
    let resolveRefresh: (value: unknown) => void = () => {};
    const refreshResponse = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith(API_ENDPOINTS.AUTH.REFRESH)) return refreshResponse;
      // First hit on each endpoint is a 401, the retry succeeds.
      const seen = fetchMock.mock.calls.filter(([u]) => u === url).length;
      return Promise.resolve(
        seen === 1
          ? jsonResponse({ message: 'nope' }, { ok: false, status: 401 })
          : jsonResponse({ url }),
      );
    });

    const svc1 = apiClient.get('/auth/me');
    const svc2 = service2ApiClient.get('/tasks');
    // Let both 401s land and queue on the refresh before it resolves.
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRefresh(jsonResponse({ ok: true }));
    await Promise.all([svc1, svc2]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith(API_ENDPOINTS.AUTH.REFRESH),
    );
    expect(refreshCalls).toHaveLength(1);
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
