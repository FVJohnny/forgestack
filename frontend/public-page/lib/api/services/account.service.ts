/**
 * Account Service
 * Self-service account operations (getMe lives in auth-service).
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { SigninActivityResponse } from '../types';

export const accountService = {
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      oldPassword,
      newPassword,
    });
  },

  /** The requester's own sign-in history: last login, known IPs and devices. */
  async getSigninActivity(): Promise<SigninActivityResponse> {
    return apiClient.get<SigninActivityResponse>(API_ENDPOINTS.AUTH.MY_ACTIVITY);
  },
};
