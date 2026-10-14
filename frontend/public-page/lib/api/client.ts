'use client';

/**
 * API Client
 * Generic HTTP client for making API requests with error handling.
 *
 * Auth uses httpOnly cookies: the browser cannot read the tokens, so there is
 * no Authorization header and no token storage here. Every request is sent
 * with `credentials: 'include'` so the cookies ride along. On a 401 the client
 * tries a one-shot cookie-based refresh and retries the original request.
 */

import { API_CONFIG, SERVICE2_API_CONFIG, API_ENDPOINTS } from './config';

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  // Internal: prevents infinite refresh loops.
  _isRetry?: boolean;
}

// Endpoints that must never trigger the refresh-and-retry flow (they are the
// auth flow itself, so a 401 there is terminal).
const NO_REFRESH_PATHS = [
  API_ENDPOINTS.AUTH.LOGIN,
  API_ENDPOINTS.AUTH.REFRESH,
  API_ENDPOINTS.AUTH.LOGOUT,
  API_ENDPOINTS.AUTH.GOOGLE,
];

// Shared in-flight refresh, module-level so concurrent 401s from ANY client
// (service-1 or service-2) trigger a single refresh call. Two parallel
// refreshes would race on refresh-token rotation and one would fail.
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refreshes the auth cookies. The refresh endpoint only exists on service-1
 * (the auth service), so this always targets API_CONFIG.baseURL no matter
 * which client hit the 401: the cookies are first-party and shared by every
 * service on the origin.
 */
function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_CONFIG.baseURL}${API_ENDPOINTS.AUTH.REFRESH}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      // Normal requests abort via their own controller; without a timeout
      // here one hung refresh would pin every queued 401 retry until the
      // socket dies.
      signal: AbortSignal.timeout(API_CONFIG.timeout),
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

class APIClient {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeout = this.defaultTimeout, _isRetry = false, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...fetchOptions,
        // Send and receive the httpOnly auth cookies.
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // On a 401, try a one-shot cookie refresh then retry once. Skip for
        // the auth endpoints themselves and for an already-retried request.
        const canRefresh = !_isRetry && !NO_REFRESH_PATHS.some((p) => endpoint.startsWith(p));
        if (response.status === 401 && canRefresh) {
          const refreshed = await attemptRefresh();
          if (refreshed) {
            return this.request<T>(endpoint, { ...options, _isRetry: true });
          }
          // Refresh failed: notify the app so it can send the user to /login.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthenticated'));
          }
        }

        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message ||
          errorData.message ||
          `Request failed with status ${response.status}`;

        throw new APIError(errorMessage, response.status, errorData);
      }

      // Handle empty responses (204 No Content or empty body)
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new APIError(error.name === 'AbortError' ? 'Request timeout' : error.message);
      }
      throw new APIError('An unknown error occurred');
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new APIClient(API_CONFIG.baseURL, API_CONFIG.timeout);

/**
 * Client for service-2 (the tasks example service), served on the same origin
 * under the /svc2 path prefix (Caddy strips it). Its 401s refresh through
 * service-1, which owns the auth endpoints.
 */
export const service2ApiClient = new APIClient(
  SERVICE2_API_CONFIG.baseURL,
  SERVICE2_API_CONFIG.timeout,
);
