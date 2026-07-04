import { MockEventBus } from '@libs/nestjs-common';
import { Activity_InMemoryRepository } from '@bc/analytics/infrastructure/repositories/in-memory/activity.in-memory-repository';
import { RecordActivity_Command } from './record-activity.command';
import { RecordActivity_CommandHandler } from './record-activity.command-handler';

describe('RecordActivity_CommandHandler', () => {
  const createCommand = (params: { userId?: string; eventType?: string; occurredOn?: Date } = {}) =>
    new RecordActivity_Command(
      params.userId ?? '3f1b9a1e-8f4d-4a7e-9c2b-1a2b3c4d5e6f',
      params.eventType ?? 'user.created',
      params.occurredOn ?? new Date(),
    );

  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const repository = new Activity_InMemoryRepository(params.shouldFailRepository);
    const eventBus = new MockEventBus();
    const handler = new RecordActivity_CommandHandler(repository, eventBus);

    return { repository, handler };
  };

  it('should persist an activity with the command values', async () => {
    // Arrange
    const { handler, repository } = setup();
    const occurredOn = new Date('2026-01-15T10:00:00Z');
    const command = createCommand({ eventType: 'user.created', occurredOn });

    // Act
    await handler.execute(command);

    // Assert
    const activities = await repository.findAll();
    expect(activities).toHaveLength(1);
    expect(activities[0].userId.toValue()).toBe(command.userId);
    expect(activities[0].eventType).toBe('user.created');
    expect(activities[0].occurredOn.toValue()).toEqual(occurredOn);
  });

  it('should propagate repository failures', async () => {
    // Arrange
    const { handler } = setup({ shouldFailRepository: true });

    // Act & Assert
    await expect(handler.execute(createCommand())).rejects.toThrow();
  });
});
