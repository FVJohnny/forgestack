/**
 * API Configuration
 * Centralized configuration for API endpoints and settings
 */

// Each service is served under a path prefix on the same origin as the
// frontend (Caddy strips /svc1 and /svc2, so each service still serves
// /api/v1 internally). The fallbacks include that prefix plus the global `api`
// prefix and URI version v1. The env templates use the same shape.
export const API_CONFIG = {
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'https://localhost/svc1/api/v1'}`,
  timeout: 10000,
} as const;

/** Service-2 — the tasks example service. Same origin, its own path prefix. */
export const SERVICE2_API_CONFIG = {
  baseURL: `${process.env.NEXT_PUBLIC_SERVICE2_API_URL || 'https://localhost/svc2/api/v1'}`,
  timeout: 10000,
} as const;

export type UserFilterField = 'email' | 'ip';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh-token',
    ME: '/auth/me',
    MY_ACTIVITY: '/auth/me/activity',
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
  // Served by service-2 (use service2ApiClient, not apiClient).
  TASKS: {
    LIST: '/tasks',
    CREATE: '/tasks',
    COMPLETE: (taskId: string) => `/tasks/${taskId}/complete`,
    DELETE: (taskId: string) => `/tasks/${taskId}`,
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
} as const;
