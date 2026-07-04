import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordReset_Repository,
} from '@bc/auth/domain/aggregates/password-reset/password-reset.repository';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Password } from '@bc/auth/domain/value-objects';
import {
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  NotFoundException,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
  PasswordResetCompleted_IntegrationEvent,
  Transaction,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { ExecutePasswordReset_Command } from './execute-password-reset.command';

export class ExecutePasswordReset_CommandHandler extends Base_CommandHandler(
  ExecutePasswordReset_Command,
) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: PasswordReset_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: ExecutePasswordReset_Command) {
    // Find the password reset
    const passwordReset = await this.passwordResetRepository.findById(
      new Id(command.passwordResetId),
    );
    if (!passwordReset) {
      throw new NotFoundException('PasswordReset', command.passwordResetId);
    }

    // Find the user by email
    const user = await this.userRepository.findByEmail(passwordReset.email);
    if (!user) {
      throw new NotFoundException('User', passwordReset.email.toValue());
    }

    // Create the new password and change it
    const newPassword = await Password.createFromPlainText(command.newPassword);
    user.changePassword(newPassword);

    // Mark password reset as used
    passwordReset.use();

    const integrationEvent = new PasswordResetCompleted_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: user.id.toValue(),
      email: user.email.toValue(),
    });

    // Update user password and mark password reset as used in a transaction
    await Transaction.run(async (context) => {
      await this.userRepository.save(user, context);
      await this.passwordResetRepository.save(passwordReset, context);
      await this.sendIntegrationEvent(integrationEvent, context);
      await this.sendDomainEvents(user);
    });
  }

  async authorize(_command: ExecutePasswordReset_Command) {
    return true;
  }

  async validate(_command: ExecutePasswordReset_Command) {}
}
