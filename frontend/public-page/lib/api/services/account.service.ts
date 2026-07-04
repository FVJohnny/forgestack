/**
 * Account Service
 * Self-service account operations (getMe lives in auth-service).
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';

export const accountService = {
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      oldPassword,
      newPassword,
    });
  },
};
