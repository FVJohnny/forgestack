/**
 * Analytics Service (service-2)
 * The example second service: aggregates user activity from the integration
 * events service-1 publishes, reached through its own hostname via Caddy.
 */

import { service2ApiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { ActivitySummaryResponse } from '../types';

export const analyticsService = {
  /** Aggregated activity counts per event type + time of the last activity. */
  async getSummary(): Promise<ActivitySummaryResponse> {
    return service2ApiClient.get<ActivitySummaryResponse>(API_ENDPOINTS.ANALYTICS.SUMMARY, {
      showErrorToast: false,
    });
  },
};
