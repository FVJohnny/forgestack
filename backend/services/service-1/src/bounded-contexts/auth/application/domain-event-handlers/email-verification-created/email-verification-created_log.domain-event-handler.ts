import { Base_DomainEventHandler } from '@libs/nestjs-common';
import { EmailVerificationCreated_DomainEvent } from '@bc/auth/domain/aggregates/email-verification/events/email-verification-created.domain-event';

export class EmailVerificationCreated_Log_DomainEventHandler extends Base_DomainEventHandler(
  EmailVerificationCreated_DomainEvent,
) {
  async handleEvent(event: EmailVerificationCreated_DomainEvent) {
    this.logger.debug(`EmailVerificationCreated_Log_DomainEventHandler ${event.email.toValue()}`);
  }
}
