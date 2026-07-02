import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteEmailVerificationByUserId_Command } from './delete-email-verification-by-user-id.command';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerification_Repository,
} from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import { Base_CommandHandler, EVENT_BUS, Id } from '@libs/nestjs-common';

export class DeleteEmailVerificationByUserId_CommandHandler extends Base_CommandHandler(
  DeleteEmailVerificationByUserId_Command,
) {
  constructor(
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerification_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: DeleteEmailVerificationByUserId_Command) {
    const userId = new Id(command.userId);

    const verification = await this.emailVerificationRepository.findByUserId(userId);
    if (verification) {
      await this.emailVerificationRepository.remove(verification.id);
    }
  }

  async authorize(_command: DeleteEmailVerificationByUserId_Command) {
    return true;
  }

  async validate(_command: DeleteEmailVerificationByUserId_Command) {}
}
