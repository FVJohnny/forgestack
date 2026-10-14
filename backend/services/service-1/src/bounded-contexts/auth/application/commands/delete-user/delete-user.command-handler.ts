import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  NotFoundException,
  UnauthorizedException,
  InvalidOperationException,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { DeleteUser_Command } from './delete-user.command';
import { UserRole } from '@bc/auth/domain/value-objects';

export class DeleteUser_CommandHandler extends Base_CommandHandler(DeleteUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: DeleteUser_Command): Promise<void> {
    const userToDelete = await this.userRepository.findById(new Id(command.userIdToDelete));
    if (!userToDelete) {
      throw new NotFoundException('User', command.userIdToDelete);
    }

    // Call the delete method on the aggregate to emit the domain event. The
    // event carries the email, so the publish handler does not re-read the user.
    userToDelete.delete();

    // Remove the user first, then publish. If publishing came first and the
    // remove failed, downstream services would already have been told the user
    // was deleted while the row still existed. Removing first means the
    // integration event is only emitted once the row is actually gone.
    await this.userRepository.remove(userToDelete.id);

    // Send domain events (including UserDeleted_DomainEvent) to trigger cascade deletion
    await this.sendDomainEvents(userToDelete);

    this.logger.log(
      `User ${command.userIdToDelete} permanently deleted by ${command.requesterUserId}`,
    );
  }

  async authorize(command: DeleteUser_Command): Promise<boolean> {
    // Only admins can delete users
    if (!command.requesterUserId) {
      throw new UnauthorizedException();
    }

    const requester = await this.userRepository.findById(new Id(command.requesterUserId));
    if (!requester) {
      throw new UnauthorizedException();
    }

    // Must be admin
    if (!requester.hasRole(UserRole.admin())) {
      this.logger.warn(
        `Non-admin user ${command.requesterUserId} attempted to delete user ${command.userIdToDelete}`,
      );
      throw new UnauthorizedException();
    }

    // Cannot delete yourself
    if (command.requesterUserId === command.userIdToDelete) {
      this.logger.warn(`Admin ${command.requesterUserId} attempted to delete themselves`);
      throw new InvalidOperationException('deleteUser', 'Cannot delete yourself');
    }

    // Cannot delete other admins
    const userToDelete = await this.userRepository.findById(new Id(command.userIdToDelete));
    if (userToDelete && userToDelete.hasRole(UserRole.admin())) {
      this.logger.warn(
        `Admin ${command.requesterUserId} attempted to delete another admin ${command.userIdToDelete}`,
      );
      throw new InvalidOperationException('deleteUser', 'Cannot delete other administrators');
    }

    return true;
  }

  async validate(_command: DeleteUser_Command): Promise<void> {}
}
