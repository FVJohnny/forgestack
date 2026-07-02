import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Base_CommandHandler, EVENT_BUS, Id, NotFoundException } from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { Logout_Command } from './logout.command';

export class Logout_CommandHandler extends Base_CommandHandler(Logout_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: Logout_Command) {
    const user = await this.userRepository.findById(new Id(command.userId));
    if (!user) {
      throw new NotFoundException('User', command.userId);
    }

    user.logout();

    await this.sendDomainEvents(user);
  }

  async authorize(_command: Logout_Command) {
    return true;
  }

  async validate(_command: Logout_Command) {}
}
