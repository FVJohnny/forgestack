import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS, type UserFilterField } from '@/lib/api/config';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GetMeResponse,
  SearchUsersResponse,
  ImpersonateResponse,
  ListUsersResponse,
  GetMotdResponse,
} from '@/lib/api/types';

class AuthService {
  private accessTokenKey = 'access_token';
  private refreshTokenKey = 'refresh_token';
  private userIdKey = 'user_id';
  // Keys for storing original admin tokens during impersonation
  private originalAccessTokenKey = 'original_admin_access_token';
  private originalRefreshTokenKey = 'original_admin_refresh_token';
  private originalUserIdKey = 'original_admin_user_id';
  // Deduplication lock for concurrent refresh calls
  private refreshPromise: Promise<AuthResponse | null | 'network_error'> | null = null;

  async register(email: string, password: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.USERS.REGISTER, {
      email,
      password,
    } as RegisterRequest);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    } as LoginRequest);

    // Store tokens and userId
    this.setAccessToken(data.accessToken);
    this.setRefreshToken(data.refreshToken);
    this.setUserId(data.userId);

    return data;
  }

  async loginWithGoogle(accessToken: string): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.GOOGLE, { accessToken });

    // Store tokens and userId
    this.setAccessToken(data.accessToken);
    this.setRefreshToken(data.refreshToken);
    this.setUserId(data.userId);

    return data;
  }

  async verifyEmailAndLogin(emailVerificationId: string): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>(API_ENDPOINTS.EMAIL_VERIFICATION.VERIFY, {
      emailVerificationId,
    });

    // Store tokens and userId for auto-login
    this.setAccessToken(data.accessToken);
    this.setRefreshToken(data.refreshToken);
    this.setUserId(data.userId);

    return data;
  }

  async getMe(): Promise<GetMeResponse> {
    return apiClient.get<GetMeResponse>(API_ENDPOINTS.AUTH.ME, {
      showErrorToast: false,
    });
  }

  async refreshToken(): Promise<AuthResponse | null | 'network_error'> {
    // Deduplicate concurrent refresh calls — share the same in-flight promise
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.executeRefreshToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async executeRefreshToken(): Promise<AuthResponse | null | 'network_error'> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const data = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.AUTH.REFRESH,
        { refreshToken },
        { showErrorToast: false },
      );

      // Update tokens
      this.setAccessToken(data.accessToken);
      this.setRefreshToken(data.refreshToken);
      this.setUserId(data.userId);

      return data;
    } catch (error: unknown) {
      // Only return null (triggering logout) for actual auth failures (401)
      // Network errors during service restart should not log users out
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as Record<string, unknown>).status
          : undefined;
      if (status === 401) {
        console.error('Token refresh failed - unauthorized:', error);
        return null;
      }

      // For network errors, timeouts, 5xx errors - don't logout, just log and continue
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Token refresh failed (transient error, not logging out):', message);
      return 'network_error';
    }
  }

  async logout(): Promise<void> {
    try {
      const token = this.getAccessToken();
      if (token) {
        // Don't show error toast if logout fails (token might already be invalid)
        await apiClient.post<void>(API_ENDPOINTS.AUTH.LOGOUT, undefined, {
          showErrorToast: false,
        });
      }
    } finally {
      // Always clear local storage, even if API call fails
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.accessTokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.userIdKey);
        // Redirect to login page
        window.location.href = '/login';
      }
    }
  }

  getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.accessTokenKey);
    }
    return null;
  }

  setAccessToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.accessTokenKey, token);
    }
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.refreshTokenKey);
    }
    return null;
  }

  setRefreshToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.refreshTokenKey, token);
    }
  }

  getUserId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.userIdKey);
    }
    return null;
  }

  setUserId(userId: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.userIdKey, userId);
    }
  }

  // Admin impersonation methods
  async searchUsers(email: string, limit: number = 10): Promise<SearchUsersResponse> {
    return apiClient.get<SearchUsersResponse>(API_ENDPOINTS.ADMIN.SEARCH_USERS(email, limit));
  }

  async listUsers(options?: {
    page?: number;
    limit?: number;
    filterField?: UserFilterField;
    filterValue?: string;
  }): Promise<ListUsersResponse> {
    return apiClient.get<ListUsersResponse>(API_ENDPOINTS.ADMIN.LIST_USERS(options));
  }

  async impersonate(userId: string): Promise<ImpersonateResponse> {
    // Save current admin tokens before impersonating
    const currentAccessToken = this.getAccessToken();
    const currentRefreshToken = this.getRefreshToken();
    const currentUserId = this.getUserId();

    if (currentAccessToken && currentRefreshToken && currentUserId) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.originalAccessTokenKey, currentAccessToken);
        localStorage.setItem(this.originalRefreshTokenKey, currentRefreshToken);
        localStorage.setItem(this.originalUserIdKey, currentUserId);
      }
    }

    // Get impersonation tokens
    const data = await apiClient.post<ImpersonateResponse>(API_ENDPOINTS.ADMIN.IMPERSONATE(userId));

    // Store impersonation tokens
    this.setAccessToken(data.accessToken);
    this.setRefreshToken(data.refreshToken);
    this.setUserId(data.userId);

    return data;
  }

  stopImpersonation(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    // Restore original admin tokens
    const originalAccessToken = localStorage.getItem(this.originalAccessTokenKey);
    const originalRefreshToken = localStorage.getItem(this.originalRefreshTokenKey);
    const originalUserId = localStorage.getItem(this.originalUserIdKey);

    if (!originalAccessToken || !originalRefreshToken || !originalUserId) {
      return false;
    }

    // Restore admin tokens
    this.setAccessToken(originalAccessToken);
    this.setRefreshToken(originalRefreshToken);
    this.setUserId(originalUserId);

    // Clear original tokens storage
    localStorage.removeItem(this.originalAccessTokenKey);
    localStorage.removeItem(this.originalRefreshTokenKey);
    localStorage.removeItem(this.originalUserIdKey);

    return true;
  }

  isImpersonating(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(this.originalAccessTokenKey) !== null;
  }

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete<void>(API_ENDPOINTS.ADMIN.DELETE_USER(userId));
  }

  async suspendUser(userId: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.ADMIN.SUSPEND_USER(userId));
  }

  async unsuspendUser(userId: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.ADMIN.UNSUSPEND_USER(userId));
  }

  // MOTD methods
  async getMotd(): Promise<GetMotdResponse | null> {
    return apiClient.get<GetMotdResponse | null>(API_ENDPOINTS.MOTD.GET, {
      showErrorToast: false,
    });
  }

  async setMotd(content: string): Promise<void> {
    await apiClient.put<void>(API_ENDPOINTS.ADMIN.SET_MOTD, { content });
  }

  async deleteMotd(): Promise<void> {
    await apiClient.delete<void>(API_ENDPOINTS.ADMIN.DELETE_MOTD);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      oldPassword,
      newPassword,
    });
  }
}

export const authService = new AuthService();
