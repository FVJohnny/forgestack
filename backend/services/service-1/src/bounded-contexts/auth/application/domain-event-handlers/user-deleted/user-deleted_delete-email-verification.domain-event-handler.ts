import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { Base_DomainEventHandler, COMMAND_BUS } from '@libs/nestjs-common';
import { UserDeleted_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-deleted.domain-event';
import { DeleteEmailVerificationByUserId_Command } from '@bc/auth/application/commands/delete-email-verification-by-user-id/delete-email-verification-by-user-id.command';

/**
 * Cascade: when a user is deleted (admin "Delete user" in the manage-users
 * panel, or any other deletion path), remove their EmailVerification record
 * too. Otherwise a subsequent re-registration with the same email fails:
 * UserRegistered → CreateEmailVerification → AlreadyExistsException, because
 * EmailVerifications are unique by email.
 */
export class UserDeleted_DeleteEmailVerification_DomainEventHandler extends Base_DomainEventHandler(
  UserDeleted_DomainEvent,
) {
  constructor(
    @Inject(COMMAND_BUS)
    private readonly commandBus: ICommandBus,
  ) {
    super();
  }

  async handleEvent(event: UserDeleted_DomainEvent) {
    await this.commandBus.execute(
      new DeleteEmailVerificationByUserId_Command({
        userId: event.aggregateId.toValue(),
      }),
    );
  }
}
