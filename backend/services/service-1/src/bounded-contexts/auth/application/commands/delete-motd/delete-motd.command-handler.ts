import { Inject } from '@nestjs/common';
import { Base_CommandHandler } from '@libs/nestjs-common';
import { DeleteMotd_Command } from './delete-motd.command';
import {
  MOTD_REPOSITORY,
  type Motd_Repository,
} from '@bc/auth/domain/aggregates/motd/motd.repository';

export class DeleteMotd_CommandHandler extends Base_CommandHandler(DeleteMotd_Command) {
  constructor(
    @Inject(MOTD_REPOSITORY)
    private readonly motdRepository: Motd_Repository,
  ) {
    super();
  }

  async handle(command: DeleteMotd_Command): Promise<void> {
    this.logger.log(`Deleting MOTD by admin user ${command.requesterUserId}`);

    await this.motdRepository.deleteCurrent();

    this.logger.log('MOTD deleted successfully');
  }

  async authorize(_command: DeleteMotd_Command): Promise<boolean> {
    // Authorization is handled by AdminRoleGuard in controller
    return true;
  }

  async validate(_command: DeleteMotd_Command): Promise<void> {
    // No validation needed
  }
}
