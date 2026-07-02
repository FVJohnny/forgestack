import { Inject } from '@nestjs/common';
import type { ICommandBus } from '@nestjs/cqrs';
import { EmailVerificationVerified_DomainEvent } from '@bc/auth/domain/aggregates/email-verification/events/email-verified.domain-event';
import { Base_DomainEventHandler, COMMAND_BUS } from '@libs/nestjs-common';
import { VerifyUserEmail_Command } from '@bc/auth/application/commands/verify-user-email/verify-user-email.command';

export class EmailVerificationVerified_UpdateUserStatus_DomainEventHandler extends Base_DomainEventHandler(
  EmailVerificationVerified_DomainEvent,
) {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {
    super();
  }

  async handleEvent(event: EmailVerificationVerified_DomainEvent) {
    const command = new VerifyUserEmail_Command(event.userId.toValue());
    await this.commandBus.execute(command);
  }
}
