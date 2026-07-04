/**
 * Admin Service
 * User administration + MOTD management (requires admin role).
 */

import { apiClient } from '../client';
import { API_ENDPOINTS, type UserFilterField } from '../config';
import type { ListUsersResponse } from '../types';

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

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete<void>(API_ENDPOINTS.ADMIN.DELETE_USER(id));
  },

  async suspendUser(id: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.ADMIN.SUSPEND_USER(id));
  },

  async unsuspendUser(id: string): Promise<void> {
    await apiClient.post<void>(API_ENDPOINTS.ADMIN.UNSUSPEND_USER(id));
  },

  async setMotd(content: string): Promise<void> {
    await apiClient.put<void>(API_ENDPOINTS.ADMIN.SET_MOTD, { content });
  },

  async deleteMotd(): Promise<void> {
    await apiClient.delete<void>(API_ENDPOINTS.ADMIN.DELETE_MOTD);
  },
};
