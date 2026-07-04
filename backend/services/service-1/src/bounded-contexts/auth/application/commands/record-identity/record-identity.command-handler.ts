import { Inject } from '@nestjs/common';
import { Base_CommandHandler, Id } from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { RecordIdentity_Command } from './record-identity.command';

export class RecordIdentity_CommandHandler extends Base_CommandHandler(RecordIdentity_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {
    super();
  }

  async handle(command: RecordIdentity_Command): Promise<void> {
    const userId = new Id(command.userId);

    // Find the user
    const user = await this.userRepository.findById(userId);

    if (!user) {
      // User not found - silently ignore (user might have been deleted)
      return;
    }

    // Record the identity data directly on the user
    user.recordIdentity({
      ip: command.ip,
      userAgent: command.userAgent,
    });

    await this.userRepository.save(user);
  }

  async authorize(_command: RecordIdentity_Command): Promise<boolean> {
    return true;
  }

  async validate(_command: RecordIdentity_Command): Promise<void> {}
}
