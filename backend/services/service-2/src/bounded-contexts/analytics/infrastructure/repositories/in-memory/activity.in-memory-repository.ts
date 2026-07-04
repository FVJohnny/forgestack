import { Base_InMemoryRepository } from '@libs/nestjs-common';
import { Activity } from '@bc/analytics/domain/aggregates/activity/activity.aggregate';
import type {
  Activity_Repository,
  ActivitySummary,
} from '@bc/analytics/domain/aggregates/activity/activity.repository';
import type { ActivityDTO } from '@bc/analytics/domain/aggregates/activity/activity.dto';

export class Activity_InMemoryRepository
  extends Base_InMemoryRepository<Activity, ActivityDTO>
  implements Activity_Repository
{
  protected toEntity(dto: ActivityDTO): Activity {
    return Activity.fromValue(dto);
  }

  async getSummary(): Promise<ActivitySummary> {
    const activities = await this.findAll();

    const byType: Record<string, number> = {};
    let lastActivityAt: Date | null = null;

    for (const activity of activities) {
      byType[activity.eventType] = (byType[activity.eventType] ?? 0) + 1;
      const occurredOn = activity.occurredOn.toValue();
      if (!lastActivityAt || occurredOn > lastActivityAt) {
        lastActivityAt = occurredOn;
      }
    }

    return { total: activities.length, byType, lastActivityAt };
  }
}
