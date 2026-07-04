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

/**
 * Auth is cookie-based: the backend sets httpOnly cookies for the access and
 * refresh tokens, so this service never touches tokens or localStorage. The
 * session is established by calling the API (the cookies ride along) and read
 * back via getMe(). Impersonation is handled entirely server-side through a
 * stacked admin cookie; the client only calls the endpoints.
 */
class AuthService {
  async register(email: string, password: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.USERS.REGISTER, {
      email,
      password,
    } as RegisterRequest);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    } as LoginRequest);
  }

  async loginWithGoogle(accessToken: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.GOOGLE, { accessToken });
  }

  async verifyEmailAndLogin(emailVerificationId: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(API_ENDPOINTS.EMAIL_VERIFICATION.VERIFY, {
      emailVerificationId,
    });
  }

  /**
   * Returns the current user, or null if there is no valid session. The API
   * client transparently attempts a cookie refresh on a 401, so this only
   * returns null when both the access and refresh cookies are gone/expired.
   */
  async getSession(): Promise<GetMeResponse | null> {
    try {
      return await this.getMe();
    } catch {
      return null;
    }
  }

  async getMe(): Promise<GetMeResponse> {
    return apiClient.get<GetMeResponse>(API_ENDPOINTS.AUTH.ME, {
      showErrorToast: false,
    });
  }

  async logout(): Promise<void> {
    // Best-effort: the backend clears the cookies. Ignore errors (the token
    // might already be invalid).
    await apiClient
      .post<void>(API_ENDPOINTS.AUTH.LOGOUT, undefined, { showErrorToast: false })
      .catch(() => {});
  }

  // Admin: impersonation. The backend stashes the admin's cookies and sets the
  // impersonated user's cookies; stopImpersonation restores the admin cookies.
  async impersonate(userId: string): Promise<ImpersonateResponse> {
    return apiClient.post<ImpersonateResponse>(API_ENDPOINTS.ADMIN.IMPERSONATE(userId));
  }

  async stopImpersonation(): Promise<{ userId: string }> {
    return apiClient.post<{ userId: string }>(API_ENDPOINTS.ADMIN.STOP_IMPERSONATION);
  }

  async listUsers(options?: {
    page?: number;
    limit?: number;
    filterField?: UserFilterField;
    filterValue?: string;
  }): Promise<ListUsersResponse> {
    return apiClient.get<ListUsersResponse>(API_ENDPOINTS.ADMIN.LIST_USERS(options));
  }

  async searchUsers(email: string, limit: number = 10): Promise<SearchUsersResponse> {
    return apiClient.get<SearchUsersResponse>(API_ENDPOINTS.ADMIN.SEARCH_USERS(email, limit));
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
