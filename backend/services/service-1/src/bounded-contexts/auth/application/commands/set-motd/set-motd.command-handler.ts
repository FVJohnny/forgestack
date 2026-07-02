import { Inject } from '@nestjs/common';
import { Base_CommandHandler } from '@libs/nestjs-common';
import { SetMotd_Command } from './set-motd.command';
import {
  MOTD_REPOSITORY,
  type Motd_Repository,
} from '@bc/auth/domain/aggregates/motd/motd.repository';
import { Motd } from '@bc/auth/domain/aggregates/motd/motd.aggregate';

export class SetMotd_CommandHandler extends Base_CommandHandler(SetMotd_Command) {
  constructor(
    @Inject(MOTD_REPOSITORY)
    private readonly motdRepository: Motd_Repository,
  ) {
    super();
  }

  async handle(command: SetMotd_Command): Promise<void> {
    this.logger.log(`Setting MOTD by admin user ${command.requesterUserId}`);

    // Check if MOTD already exists
    const existingMotd = await this.motdRepository.findCurrent();

    if (existingMotd) {
      // Update existing MOTD
      existingMotd.updateContent(command.content);
      await this.motdRepository.save(existingMotd);
      this.logger.log('MOTD updated successfully');
    } else {
      // Create new MOTD
      const motd = Motd.create({ content: command.content });
      await this.motdRepository.save(motd);
      this.logger.log('MOTD created successfully');
    }
  }

  async authorize(_command: SetMotd_Command): Promise<boolean> {
    // Authorization is handled by AdminRoleGuard in controller
    return true;
  }

  async validate(_command: SetMotd_Command): Promise<void> {
    // Content validation could be added here if needed
  }
}
