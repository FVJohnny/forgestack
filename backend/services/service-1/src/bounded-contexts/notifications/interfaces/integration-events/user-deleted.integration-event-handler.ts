import { Inject } from '@nestjs/common';
import {
  IntegrationEventHandler,
  UserDeleted_IntegrationEvent,
  CorrelationLogger,
  Id,
} from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/notifications/domain/aggregates/user/user.repository';

@IntegrationEventHandler(UserDeleted_IntegrationEvent)
export class UserDeleted_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserDeleted_IntegrationEventHandler.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {}

  async handleEvent(event: UserDeleted_IntegrationEvent): Promise<void> {
    this.logger.log(
      `🗑️  User deleted event received - deleting notifications data for user: ${event.userId}`,
    );

    const userId = new Id(event.userId);

    try {
      // Delete the local user projection
      await this.userRepository.remove(userId);
      this.logger.log(`✅ Deleted notifications user projection ${userId.toValue()}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete notifications data for user ${event.userId}`,
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }
}
