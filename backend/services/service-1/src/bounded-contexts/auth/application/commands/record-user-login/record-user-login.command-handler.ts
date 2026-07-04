import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  NotFoundException,
  Transaction,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { RecordUserLogin_Command } from './record-user-login.command';

export class RecordUserLogin_CommandHandler extends Base_CommandHandler(RecordUserLogin_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: RecordUserLogin_Command) {
    const user = await this.userRepository.findById(new Id(command.userId));

    if (!user) {
      throw new NotFoundException();
    }

    user.recordLogin();

    await Transaction.run(async (context) => {
      await this.userRepository.save(user, context);
      await this.sendDomainEvents<User>(user);
    });
  }

  async authorize(_command: RecordUserLogin_Command) {
    return true;
  }

  async validate(_command: RecordUserLogin_Command) {}
}
