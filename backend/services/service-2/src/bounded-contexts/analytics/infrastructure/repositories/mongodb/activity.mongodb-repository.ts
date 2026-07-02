import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { Activity } from '@bc/analytics/domain/aggregates/activity/activity.aggregate';
import {
  Activity_Repository,
  ActivitySummary,
} from '@bc/analytics/domain/aggregates/activity/activity.repository';
import { ActivityDTO } from '@bc/analytics/domain/aggregates/activity/activity.dto';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class Activity_MongodbRepository
  extends Base_MongoRepository<Activity, ActivityDTO>
  implements Activity_Repository
{
  static readonly CollectionName = 'analytics_activities';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, Activity_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: ActivityDTO): Activity {
    return Activity.fromValue(dto);
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: { unique: true, name: 'ux_aggregate_id' },
      },
      {
        fields: { eventType: 1 },
        options: { name: 'ix_event_type' },
      },
    ];
  }

  async getSummary(): Promise<ActivitySummary> {
    const groups = await this.collection
      .aggregate<{ _id: string; count: number; lastOccurredOn: Date }>([
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            lastOccurredOn: { $max: '$occurredOn' },
          },
        },
      ])
      .toArray();

    const byType: Record<string, number> = {};
    let total = 0;
    let lastActivityAt: Date | null = null;

    for (const group of groups) {
      byType[group._id] = group.count;
      total += group.count;
      if (!lastActivityAt || group.lastOccurredOn > lastActivityAt) {
        lastActivityAt = group.lastOccurredOn;
      }
    }

    return { total, byType, lastActivityAt };
  }
}
