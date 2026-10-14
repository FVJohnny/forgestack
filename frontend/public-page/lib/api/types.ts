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

// Tokens are delivered as httpOnly cookies, so the body only carries the id.
export interface AuthResponse {
  userId: string;
}

export interface GetMeResponse {
  userId: string;
  email: string;
  role: string;
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

export interface ListUsersResponse {
  users: SearchUserResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// MOTD types
export interface GetMotdResponse {
  content: string;
  updatedAt: string;
}

// Sign-in activity (auth service): last login plus the known IPs/devices.
export interface SigninActivityEntry {
  value: string;
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
}

export interface SigninActivityResponse {
  lastLogin: string | null;
  ips: SigninActivityEntry[];
  userAgents: SigninActivityEntry[];
}

// Tasks (service-2): the starter user-facing feature.
export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListTasksResponse {
  /** The newest tasks, at most `limit` of them. */
  tasks: TaskItem[];
  /** All of the user's tasks, including any beyond `limit`. */
  total: number;
  /** All of the user's open tasks, including any beyond `limit`. */
  open: number;
  /** The cap on `tasks`; `total > tasks.length` means the list is truncated. */
  limit: number;
}

export interface CreateTaskRequest {
  title: string;
}
