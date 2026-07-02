import { Inject } from '@nestjs/common';
import { VerifyUserEmail_Command } from './verify-user-email.command';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { Base_CommandHandler, Id, NotFoundException } from '@libs/nestjs-common';

export class VerifyUserEmail_CommandHandler extends Base_CommandHandler(VerifyUserEmail_Command) {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: User_Repository) {
    super();
  }

  async handle(command: VerifyUserEmail_Command): Promise<void> {
    const userId = new Id(command.userId);
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('userId', command.userId);
    }

    user.verifyEmail();
    await this.userRepository.save(user);
  }

  async authorize(_command: VerifyUserEmail_Command): Promise<boolean> {
    return true;
  }

  async validate(_command: VerifyUserEmail_Command): Promise<void> {}
}
