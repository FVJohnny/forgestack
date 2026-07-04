import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import {
  Base_CommandHandler,
  EVENT_BUS,
  ForbiddenException,
  Id,
  NotFoundException,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
  Transaction,
} from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Password } from '@bc/auth/domain/value-objects';
import { ChangePassword_Command } from './change-password.command';

export class ChangePassword_CommandHandler extends Base_CommandHandler(ChangePassword_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: ChangePassword_Command) {
    const user = await this.userRepository.findById(new Id(command.userId));
    if (!user) {
      throw new NotFoundException('User', command.userId);
    }

    // Verify old password
    const isOldPasswordCorrect = await user.password.verify(command.oldPassword);
    if (!isOldPasswordCorrect) {
      throw new ForbiddenException('Invalid current password');
    }

    // Create new password and change it
    const newPassword = await Password.createFromPlainText(command.newPassword);
    user.changePassword(newPassword);

    await Transaction.run(async (context) => {
      await this.userRepository.save(user, context);
      await this.sendDomainEvents(user);
    });
  }

  async authorize(_command: ChangePassword_Command) {
    return true;
  }

  async validate(_command: ChangePassword_Command) {}
}
