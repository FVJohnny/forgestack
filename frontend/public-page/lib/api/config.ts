/**
 * API Configuration
 * Centralized configuration for API endpoints and settings
 */

// The backend serves everything under the global `api` prefix plus URI
// version v1, so the fallbacks must include it: a bare host 404s on every
// call. The env templates all use `.../api/v1` too.
export const API_CONFIG = {
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`,
  timeout: 10000,
} as const;

/** Service-2 — the analytics example service. Separate host, same API shape. */
export const SERVICE2_API_CONFIG = {
  baseURL: `${process.env.NEXT_PUBLIC_SERVICE2_API_URL || 'http://localhost:3001/api/v1'}`,
  timeout: 10000,
} as const;

export type UserFilterField = 'email' | 'ip';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh-token',
    ME: '/auth/me',
    GOOGLE: '/auth/google',
    PASSWORD_RESET: '/auth/password-reset',
    PASSWORD_RESET_EXECUTE: '/auth/password-reset/execute',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  EMAIL_VERIFICATION: {
    VERIFY: '/email-verification/verify',
  },
  USERS: {
    REGISTER: '/users',
  },
  DASHBOARD: {
    EVENTS: '/dashboard/events',
    HEALTH: '/dashboard/health',
  },
  ADMIN: {
    LIST_USERS: (options?: {
      page?: number;
      limit?: number;
      filterField?: UserFilterField;
      filterValue?: string;
    }) => {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.filterField) params.append('filterField', options.filterField);
      if (options?.filterValue) params.append('filterValue', options.filterValue);
      return `/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
    },
    DELETE_USER: (userId: string) => `/admin/users/${userId}`,
    SUSPEND_USER: (userId: string) => `/admin/users/${userId}/suspend`,
    UNSUSPEND_USER: (userId: string) => `/admin/users/${userId}/unsuspend`,
    SET_MOTD: '/admin/motd',
    DELETE_MOTD: '/admin/motd',
  },
  MOTD: {
    GET: '/motd',
  },
  // Served by service-2 (use service2ApiClient, not apiClient). The browser hits
  // the JWT-protected dashboard route; /analytics/summary is internal-key only.
  ANALYTICS: {
    SUMMARY: '/analytics/dashboard/summary',
  },
} as const;
