import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RevokeAllUserTokens_Command } from './revoke-all-user-tokens.command';
import {
  Base_CommandHandler,
  EVENT_BUS,
  Id,
  USER_TOKEN_REPOSITORY,
  type UserToken_Repository,
} from '@libs/nestjs-common';

export class RevokeAllUserTokens_CommandHandler extends Base_CommandHandler(
  RevokeAllUserTokens_Command,
) {
  constructor(
    @Inject(USER_TOKEN_REPOSITORY)
    private readonly tokenRepository: UserToken_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: RevokeAllUserTokens_Command) {
    const userId = new Id(command.userId);
    await this.tokenRepository.revokeAllUserTokens(userId);
  }

  async authorize(_command: RevokeAllUserTokens_Command) {
    return true;
  }

  async validate(_command: RevokeAllUserTokens_Command) {}
}
