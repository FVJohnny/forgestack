import { type ICommandBus } from '@nestjs/cqrs';
import { UserRegistered_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-registered.domain-event';
import { CreateEmailVerification_Command } from '@bc/auth/application/commands/create-email-verification/create-email-verification.command';
import { COMMAND_BUS, Base_DomainEventHandler } from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';

export class UserRegistered_CreateEmailVerification_DomainEventHandler extends Base_DomainEventHandler(
  UserRegistered_DomainEvent,
) {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {
    super();
  }

  async handleEvent(event: UserRegistered_DomainEvent) {
    const createEmailVerificationCommand = new CreateEmailVerification_Command({
      userId: event.aggregateId.toValue(),
      email: event.email.toValue(),
      // Skip the "verify your email" flow when the email is already considered
      // verified (this example disables verification; Google also self-verifies).
      emailAlreadyVerified: event.emailVerified || event.authProvider === 'google',
    });

    await this.commandBus.execute(createEmailVerificationCommand);
  }
}
