import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteUser_Command } from './delete-user.command';
import { Base_CommandHandler, EVENT_BUS, Id } from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/notifications/domain/aggregates/user/user.repository';

export class DeleteUser_CommandHandler extends Base_CommandHandler(DeleteUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: DeleteUser_Command) {
    const userId = new Id(command.userId);

    this.logger.log(
      `Deleting user projection in notifications context (User ID: ${userId.toValue()})`,
    );

    await this.userRepository.remove(userId);

    this.logger.log(`User projection deleted successfully (User ID: ${userId.toValue()})`);
  }

  async authorize(_command: DeleteUser_Command): Promise<boolean> {
    return true;
  }

  async validate(_command: DeleteUser_Command): Promise<void> {}
}
