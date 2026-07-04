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
import { SuspendUser_Command } from './suspend-user.command';
import { UserRole } from '@bc/auth/domain/value-objects';

export class SuspendUser_CommandHandler extends Base_CommandHandler(SuspendUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: SuspendUser_Command): Promise<void> {
    const userToSuspend = await this.userRepository.findById(new Id(command.userIdToSuspend));
    if (!userToSuspend) {
      throw new NotFoundException('User', command.userIdToSuspend);
    }

    // Call the suspend method on the aggregate
    userToSuspend.suspend();

    // Persist the suspended user
    await this.userRepository.save(userToSuspend);

    // Send domain events if any
    await this.sendDomainEvents(userToSuspend);

    this.logger.log(`User ${command.userIdToSuspend} suspended by ${command.requesterUserId}`);
  }

  async authorize(command: SuspendUser_Command): Promise<boolean> {
    // Only admins can suspend users
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
        `Non-admin user ${command.requesterUserId} attempted to suspend user ${command.userIdToSuspend}`,
      );
      throw new UnauthorizedException();
    }

    return true;
  }

  async validate(_command: SuspendUser_Command): Promise<void> {}
}
