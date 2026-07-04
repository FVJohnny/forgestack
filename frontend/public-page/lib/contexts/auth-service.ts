import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/config';
import type { AuthResponse, LoginRequest, RegisterRequest, GetMeResponse } from '@/lib/api/types';

/**
 * Auth is cookie-based: the backend sets httpOnly cookies for the access and
 * refresh tokens, so this service never touches tokens or localStorage. The
 * session is established by calling the API (the cookies ride along) and read
 * back via getMe().
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

  // Admin (list/search/delete/suspend users) and MOTD live in admin.service.ts;
  // change-password lives in account.service.ts. This service is auth-only.

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.AUTH.PASSWORD_RESET, { email });
  }

  async executePasswordReset(passwordResetId: string, newPassword: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.AUTH.PASSWORD_RESET_EXECUTE, {
      passwordResetId,
      newPassword,
    });
  }
}

export const authService = new AuthService();
