import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordReset_Repository,
} from '@bc/auth/domain/aggregates/password-reset/password-reset.repository';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Email } from '@bc/auth/domain/value-objects';
import {
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
  PasswordResetRequested_IntegrationEvent,
  Transaction,
  AlreadyExistsException,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { RequestPasswordReset_Command } from './request-password-reset.command';
import {
  PASSWORD_RESET_UNIQUENESS_CHECKER,
  type IPasswordResetUniquenessChecker,
} from '@bc/auth/domain/services/password-reset-uniqueness-checker.interface';

export class RequestPasswordReset_CommandHandler extends Base_CommandHandler(
  RequestPasswordReset_Command,
) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: PasswordReset_Repository,
    @Inject(PASSWORD_RESET_UNIQUENESS_CHECKER)
    private readonly uniquenessChecker: IPasswordResetUniquenessChecker,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: RequestPasswordReset_Command) {
    const email = new Email(command.email);

    // Check if user exists
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Just return silently if user does not exist
      return;
    }

    let passwordReset: PasswordReset;
    try {
      // Domain enforces business rule: don't create duplicate usable password resets
      passwordReset = await PasswordReset.create({ email: user.email }, this.uniquenessChecker);
    } catch (error) {
      // Security: If a valid password reset already exists (AlreadyExistsException),
      // silently succeed to avoid revealing information
      if (error instanceof AlreadyExistsException) return;
      throw error;
    }

    const integrationEvent = new PasswordResetRequested_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      email: passwordReset.email.toValue(),
      passwordResetId: passwordReset.id.toValue(),
      expiresAt: passwordReset.expiration.toValue(),
    });

    await Transaction.run(async (context) => {
      await this.passwordResetRepository.save(passwordReset, context);
      await this.sendIntegrationEvent(integrationEvent, context);
      await this.sendDomainEvents<PasswordReset>(passwordReset);
    });
  }

  async authorize(_command: RequestPasswordReset_Command) {
    return true;
  }

  async validate(_command: RequestPasswordReset_Command) {}
}
