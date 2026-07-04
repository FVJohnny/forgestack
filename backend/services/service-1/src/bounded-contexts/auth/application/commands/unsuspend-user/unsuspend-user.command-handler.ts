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
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { UnsuspendUser_Command } from './unsuspend-user.command';
import { UserRole } from '@bc/auth/domain/value-objects';

export class UnsuspendUser_CommandHandler extends Base_CommandHandler(UnsuspendUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: UnsuspendUser_Command): Promise<void> {
    const userToUnsuspend = await this.userRepository.findById(new Id(command.userIdToUnsuspend));
    if (!userToUnsuspend) {
      throw new NotFoundException('User', command.userIdToUnsuspend);
    }

    // Call the unsuspend method on the aggregate
    userToUnsuspend.unsuspend();

    // Persist the unsuspended user
    await this.userRepository.save(userToUnsuspend);

    // Send domain events if any
    await this.sendDomainEvents(userToUnsuspend);

    this.logger.log(`User ${command.userIdToUnsuspend} unsuspended by ${command.requesterUserId}`);
  }

  async authorize(command: UnsuspendUser_Command): Promise<boolean> {
    // Only admins can unsuspend users
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
        `Non-admin user ${command.requesterUserId} attempted to unsuspend user ${command.userIdToUnsuspend}`,
      );
      throw new UnauthorizedException();
    }

    return true;
  }

  async validate(_command: UnsuspendUser_Command): Promise<void> {}
}
