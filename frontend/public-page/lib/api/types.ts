/**
 * API Type Definitions
 * Shared types for API requests and responses
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  emailVerificationId: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface GetMeResponse {
  userId: string;
  email: string;
  role: string;
  isImpersonating?: boolean;
  originalEmail?: string;
}

export interface SearchUserResult {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  ips?: string[];
  userAgents?: string[];
}

export interface SearchUsersResponse {
  users: SearchUserResult[];
}

export interface ListUsersResponse {
  users: SearchUserResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImpersonateResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  impersonatedEmail: string;
}

// MOTD types
export interface GetMotdResponse {
  content: string;
  updatedAt: string;
}

// Dashboard / observability types
export interface HealthCheck {
  status: string;
  [key: string]: unknown;
}

export interface DashboardHealthResponse {
  ready: boolean;
  checks: Record<string, HealthCheck>;
  service: string;
  environment: string;
  timestamp: string;
}

export interface EventTypeStat {
  eventName: string;
  topic: string;
  successCount: number;
  failureCount: number;
  lastProcessed?: string;
}

export interface DashboardEventsResponse {
  service: string;
  totalEventsProcessed: number;
  timestamp: string;
  eventsByType: EventTypeStat[];
}

/** From service-2's analytics context — activity derived from integration events. */
export interface ActivitySummaryResponse {
  total: number;
  byType: Record<string, number>;
  lastActivityAt: string | null;
}
