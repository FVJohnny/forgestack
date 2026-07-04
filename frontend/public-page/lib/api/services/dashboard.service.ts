/**
 * Dashboard Service
 * Observability + health endpoints for the dev console.
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { DashboardEventsResponse, DashboardHealthResponse, GetMotdResponse } from '../types';

export const dashboardService = {
  /** Browser-friendly health snapshot (ready + per-check status). */
  async getHealth(): Promise<DashboardHealthResponse> {
    return apiClient.get<DashboardHealthResponse>(API_ENDPOINTS.DASHBOARD.HEALTH, {
      showErrorToast: false,
    });
  },

  /** Event-flow throughput data (totals + per-event success/failure). */
  async getEvents(): Promise<DashboardEventsResponse> {
    return apiClient.get<DashboardEventsResponse>(API_ENDPOINTS.DASHBOARD.EVENTS, {
      showErrorToast: false,
    });
  },

  /** Public message-of-the-day; null when none set. */
  async getMotd(): Promise<GetMotdResponse | null> {
    return apiClient.get<GetMotdResponse | null>(API_ENDPOINTS.MOTD.GET, {
      showErrorToast: false,
    });
  },
};
