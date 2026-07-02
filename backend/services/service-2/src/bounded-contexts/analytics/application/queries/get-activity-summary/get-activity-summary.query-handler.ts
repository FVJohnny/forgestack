import { Inject } from '@nestjs/common';
import { Base_QueryHandler } from '@libs/nestjs-common';
import {
  ACTIVITY_REPOSITORY,
  type Activity_Repository,
} from '@bc/analytics/domain/aggregates/activity/activity.repository';
import { GetActivitySummary_Query } from './get-activity-summary.query';
import type { GetActivitySummary_QueryResponse } from './get-activity-summary.query-response';

export class GetActivitySummary_QueryHandler extends Base_QueryHandler(
  GetActivitySummary_Query,
)<GetActivitySummary_QueryResponse>() {
  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: Activity_Repository,
  ) {
    super();
  }

  async handle(_query: GetActivitySummary_Query): Promise<GetActivitySummary_QueryResponse> {
    return this.activityRepository.getSummary();
  }

  async authorize(_query: GetActivitySummary_Query) {
    return true;
  }

  async validate(_query: GetActivitySummary_Query) {}
}
