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
import { handleAPIError } from './error-handler';

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
  showErrorToast?: boolean;
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

class APIClient {
  private baseURL: string;
  private defaultTimeout: number;
  // Shared in-flight refresh so concurrent 401s trigger a single refresh call.
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
  }

  private async attemptRefresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = fetch(`${this.baseURL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then((res) => res.ok)
        .catch(() => false)
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      timeout = this.defaultTimeout,
      showErrorToast = false,
      _isRetry = false,
      ...fetchOptions
    } = options;

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
          const refreshed = await this.attemptRefresh();
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

        const apiError = new APIError(errorMessage, response.status, errorData);

        if (showErrorToast) {
          handleAPIError(apiError);
        }

        throw apiError;
      }

      // Handle empty responses (204 No Content or empty body)
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error;
      }

      let apiError: APIError;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          apiError = new APIError('Request timeout');
        } else {
          apiError = new APIError(error.message);
        }
      } else {
        apiError = new APIError('An unknown error occurred');
      }

      if (showErrorToast) {
        handleAPIError(apiError);
      }

      throw apiError;
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

/** Client for service-2 (analytics example service) — its own host via Caddy. */
export const service2ApiClient = new APIClient(
  SERVICE2_API_CONFIG.baseURL,
  SERVICE2_API_CONFIG.timeout,
);
