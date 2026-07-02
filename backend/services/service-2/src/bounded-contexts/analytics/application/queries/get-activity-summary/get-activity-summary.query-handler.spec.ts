import { DateVO } from '@libs/nestjs-common';
import { Activity } from '@bc/analytics/domain/aggregates/activity/activity.aggregate';
import { Activity_InMemoryRepository } from '@bc/analytics/infrastructure/repositories/in-memory/activity.in-memory-repository';
import { GetActivitySummary_Query } from './get-activity-summary.query';
import { GetActivitySummary_QueryHandler } from './get-activity-summary.query-handler';

describe('GetActivitySummary_QueryHandler', () => {
  const setup = () => {
    const repository = new Activity_InMemoryRepository();
    const handler = new GetActivitySummary_QueryHandler(repository);

    return { repository, handler };
  };

  it('should return an empty summary when there is no activity', async () => {
    // Arrange
    const { handler } = setup();

    // Act
    const summary = await handler.execute(new GetActivitySummary_Query());

    // Assert
    expect(summary).toEqual({ total: 0, byType: {}, lastActivityAt: null });
  });

  it('should count activities per event type and track the latest one', async () => {
    // Arrange
    const { handler, repository } = setup();
    const latest = new Date('2026-02-01T12:00:00Z');
    await repository.save(
      Activity.random({ eventType: 'user.created', occurredOn: new DateVO('2026-01-01') }),
    );
    await repository.save(
      Activity.random({ eventType: 'user.created', occurredOn: new DateVO(latest) }),
    );
    await repository.save(
      Activity.random({ eventType: 'user.deleted', occurredOn: new DateVO('2026-01-20') }),
    );

    // Act
    const summary = await handler.execute(new GetActivitySummary_Query());

    // Assert
    expect(summary.total).toBe(3);
    expect(summary.byType).toEqual({ 'user.created': 2, 'user.deleted': 1 });
    expect(summary.lastActivityAt).toEqual(latest);
  });
});
