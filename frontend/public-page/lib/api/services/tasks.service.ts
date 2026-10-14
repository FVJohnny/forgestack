/**
 * Tasks Service (service-2)
 * The starter user-facing feature: a personal todo list owned by the signed-in
 * user, served by the second service through its own path prefix.
 */

import { service2ApiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { CreateTaskRequest, ListTasksResponse } from '../types';

export const tasksService = {
  /** The signed-in user's tasks, newest first. */
  async listTasks(): Promise<ListTasksResponse> {
    return service2ApiClient.get<ListTasksResponse>(API_ENDPOINTS.TASKS.LIST);
  },

  async createTask(title: string): Promise<void> {
    await service2ApiClient.post<void>(API_ENDPOINTS.TASKS.CREATE, {
      title,
    } satisfies CreateTaskRequest);
  },

  async completeTask(taskId: string): Promise<void> {
    await service2ApiClient.patch<void>(API_ENDPOINTS.TASKS.COMPLETE(taskId));
  },

  async deleteTask(taskId: string): Promise<void> {
    await service2ApiClient.delete<void>(API_ENDPOINTS.TASKS.DELETE(taskId));
  },
};
