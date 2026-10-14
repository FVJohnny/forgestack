/**
 * MOTD Service
 * The public announcement the admins set; shown to every signed-in user.
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { GetMotdResponse } from '../types';

export const motdService = {
  /** Public message-of-the-day; null when none set. */
  async getMotd(): Promise<GetMotdResponse | null> {
    return apiClient.get<GetMotdResponse | null>(API_ENDPOINTS.MOTD.GET);
  },
};
