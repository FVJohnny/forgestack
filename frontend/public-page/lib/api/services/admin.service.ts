/**
 * Admin Service
 * User administration + MOTD management (requires admin role).
 */

import { apiClient } from '../client';
import { API_ENDPOINTS, type UserFilterField } from '../config';
import type { ImpersonateResponse, ListUsersResponse, SearchUsersResponse } from '../types';

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  filterField?: UserFilterField;
  filterValue?: string;
}

export const adminService = {
  async listUsers(options?: ListUsersOptions): Promise<ListUsersResponse> {
    return apiClient.get<ListUsersResponse>(API_ENDPOINTS.ADMIN.LIST_USERS(options));
  },

  async searchUsers(email: string, limit = 10): Promise<SearchUsersResponse> {
    return apiClient.get<SearchUsersResponse>(API_ENDPOINTS.ADMIN.SEARCH_USERS(email, limit));
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete<void>(API_ENDPOINTS.ADMIN.DELETE_USER(id));
  },

  async suspendUser(id: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.ADMIN.SUSPEND_USER(id));
  },

  async unsuspendUser(id: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.ADMIN.UNSUSPEND_USER(id));
  },

  async impersonate(id: string): Promise<ImpersonateResponse> {
    return apiClient.post<ImpersonateResponse>(API_ENDPOINTS.ADMIN.IMPERSONATE(id));
  },

  async setMotd(content: string): Promise<void> {
    await apiClient.put<void>(API_ENDPOINTS.ADMIN.SET_MOTD, { content });
  },

  async deleteMotd(): Promise<void> {
    await apiClient.delete<void>(API_ENDPOINTS.ADMIN.DELETE_MOTD);
  },
};
