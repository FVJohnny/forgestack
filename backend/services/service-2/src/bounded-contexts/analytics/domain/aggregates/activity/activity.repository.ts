import type { Repository } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';
import type { Activity } from './activity.aggregate';

export const ACTIVITY_REPOSITORY = Symbol('ActivityRepository');

export interface ActivitySummary {
  total: number;
  byType: Record<string, number>;
  lastActivityAt: Date | null;
}

export interface Activity_Repository extends Repository<Activity, Id> {
  /** Aggregated view powering the analytics endpoint. */
  getSummary(): Promise<ActivitySummary>;
}
