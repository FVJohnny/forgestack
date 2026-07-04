import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateEmailVerification_Command } from './create-email-verification.command';
import {
  AlreadyExistsException,
  NotFoundException,
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
  EmailVerificationCreated_IntegrationEvent,
  EmailVerified_IntegrationEvent,
  UserCreated_IntegrationEvent,
  Transaction,
} from '@libs/nestjs-common';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { Email, UserRole } from '@bc/auth/domain/value-objects';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerification_Repository,
} from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import { USER_REPOSITORY } from '@bc/auth/domain/aggregates/user/user.repository';
import type { User_Repository } from '@bc/auth/domain/aggregates/user/user.repository';

export class CreateEmailVerification_CommandHandler extends Base_CommandHandler(
  CreateEmailVerification_Command,
) {
  constructor(
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerification_Repository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: CreateEmailVerification_Command) {
    const userId = new Id(command.userId);
    const email = new Email(command.email);

    // UserCreated drives the per-context user projections (e.g. notifications).
    // It must be published for every new user, regardless of how the email
    // was verified.
    const userCreatedIntegrationEvent = new UserCreated_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: command.userId,
      email: command.email,
      role: UserRole.user().toValue(),
    });

    // Google (and other pre-verified) signups: skip the verification flow and
    // its "verify your email" email. Emit EmailVerified directly so the welcome
    // email is still sent.
    if (command.emailAlreadyVerified) {
      const emailVerifiedIntegrationEvent = new EmailVerified_IntegrationEvent({
        id: Id.random().toValue(),
        occurredOn: new Date(),
        userId: command.userId,
        email: command.email,
        emailVerificationId: Id.random().toValue(),
      });

      await Transaction.run(async (context) => {
        this.logger.log(
          `Email pre-verified for userId: ${userId.toValue()} — skipping verification`,
        );
        await this.sendIntegrationEvent(emailVerifiedIntegrationEvent, context);
        await this.sendIntegrationEvent(userCreatedIntegrationEvent, context);
      });
      return;
    }

    const emailVerification = EmailVerification.create({
      userId,
      email,
    });

    const emailVerificationIntegrationEvent = new EmailVerificationCreated_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: emailVerification.userId.toValue(),
      email: emailVerification.email.toValue(),
      emailVerificationId: emailVerification.id.toValue(),
      expiresAt: emailVerification.expiration.toValue(),
    });

    await Transaction.run(async (context) => {
      this.logger.log(`Creating email verification for userId: ${userId.toValue()}`);
      await this.emailVerificationRepository.save(emailVerification, context);
      this.logger.log(`Email verification created with id: ${emailVerification.id.toValue()}`);

      const createdEmailVerification = await this.emailVerificationRepository.findByUserId(
        userId,
        context,
      );
      if (!createdEmailVerification) {
        throw new NotFoundException('EmailVerification', userId.toValue());
      }
      await this.sendDomainEvents<EmailVerification>(emailVerification);
      await this.sendIntegrationEvent(emailVerificationIntegrationEvent, context);
      await this.sendIntegrationEvent(userCreatedIntegrationEvent, context);
    });
  }

  async authorize(_command: CreateEmailVerification_Command) {
    return true;
  }

  async validate(command: CreateEmailVerification_Command) {
    // Pre-verified signups create no EmailVerification, so the uniqueness checks
    // below (which guard against duplicate verifications) don't apply.
    if (command.emailAlreadyVerified) return;

    const existingVerificationByEmail = await this.emailVerificationRepository.findByEmail(
      new Email(command.email),
    );
    if (existingVerificationByEmail) {
      throw new AlreadyExistsException('email', command.email);
    }

    const existingVerificationByUserId = await this.emailVerificationRepository.findByUserId(
      new Id(command.userId),
    );
    if (existingVerificationByUserId) {
      throw new AlreadyExistsException('userId', command.userId);
    }
  }
}
