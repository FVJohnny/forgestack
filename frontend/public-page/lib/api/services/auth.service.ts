/**
 * Auth Service
 * API service for authentication
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { LoginRequest, RegisterRequest, VerifyEmailRequest, AuthResponse } from '../types';

export const authService = {
  /**
   * Register a new user with email and password
   */
  async register(credentials: RegisterRequest): Promise<void> {
    return apiClient.post<void>(`${API_ENDPOINTS.USERS.REGISTER}`, credentials);
  },

  /**
   * Verify user email address and return tokens for auto-login
   */
  async verifyEmail(request: VerifyEmailRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(`${API_ENDPOINTS.EMAIL_VERIFICATION.VERIFY}`, request);
  },

  /**
   * Login user with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(`${API_ENDPOINTS.AUTH.LOGIN}`, credentials);
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(`${API_ENDPOINTS.AUTH.REFRESH}`, { refreshToken });
  },

  /**
   * Logout user (optional backend call)
   */
  async logout(): Promise<void> {
    return apiClient.post<void>(`${API_ENDPOINTS.AUTH.LOGOUT}`);
  },

  /**
   * Request a password reset link
   */
  async requestPasswordReset(email: string): Promise<void> {
    return apiClient.post<void>(`${API_ENDPOINTS.AUTH.PASSWORD_RESET}`, { email });
  },

  /**
   * Execute password reset with a new password
   */
  async executePasswordReset(passwordResetId: string, newPassword: string): Promise<void> {
    return apiClient.post<void>(`${API_ENDPOINTS.AUTH.PASSWORD_RESET_EXECUTE}`, {
      passwordResetId,
      newPassword,
    });
  },
};
