'use client';

/**
 * API Client
 * Generic HTTP client for making API requests with error handling
 */

import { API_CONFIG, SERVICE2_API_CONFIG } from './config';
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
}

class APIClient {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeout = this.defaultTimeout, showErrorToast = false, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Get access token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Extract error message from nested structure (error.message) or top-level (message)
        let errorMessage =
          errorData.error?.message ||
          errorData.message ||
          `Request failed with status ${response.status}`;

        // Clean up domain validation error messages to show only the rule
        if (errorMessage.includes('Rule: ')) {
          errorMessage = errorMessage.split('Rule: ')[1] || errorMessage;
        }

        // Handle 401 globally - redirect to login (except for auth endpoints)
        if (response.status === 401 && !endpoint.includes('/auth/')) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user_id');
            window.location.href = '/login';
            return {} as T; // Return empty to prevent further processing
          }
        }

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
      body: JSON.stringify(data),
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
