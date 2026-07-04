import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { VerifyEmail_Command } from './verify-email.command';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerification_Repository,
} from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import {
  Base_CommandHandler,
  EVENT_BUS,
  NotFoundException,
  Id,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
  EmailVerified_IntegrationEvent,
  Transaction,
} from '@libs/nestjs-common';

export class VerifyEmail_CommandHandler extends Base_CommandHandler(VerifyEmail_Command) {
  constructor(
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerification_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: VerifyEmail_Command): Promise<void> {
    const emailVerification = await this.emailVerificationRepository.findById(
      new Id(command.emailVerificationId),
    );

    if (!emailVerification) {
      throw new NotFoundException('email verification');
    }

    emailVerification.verify();

    const integrationEvent = new EmailVerified_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: emailVerification.userId.toValue(),
      email: emailVerification.email.toValue(),
      emailVerificationId: emailVerification.id.toValue(),
    });

    await Transaction.run(async (context) => {
      await this.emailVerificationRepository.save(emailVerification, context);
      await this.sendIntegrationEvent(integrationEvent, context);
      await this.sendDomainEvents(emailVerification);
    });
  }

  async authorize(_command: VerifyEmail_Command) {
    return true;
  }

  async validate(_command: VerifyEmail_Command) {}
}
