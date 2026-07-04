import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RevokeToken_Command } from './revoke-token.command';
import {
  USER_TOKEN_REPOSITORY,
  type UserToken_Repository,
} from '../../../domain/repositories/user-token.repository';
import { Base_CommandHandler } from '../../../../cqrs/base.command-handler';
import { EVENT_BUS } from '../../../../cqrs/cqrs.module';
import { Token } from '../../../domain/entities/token.vo';

/**
 * Revokes a single stored token (used for refresh-token rotation: the
 * presented refresh token is revoked once new tokens are issued).
 * Revoking a token that no longer exists is a no-op.
 */
export class RevokeToken_CommandHandler extends Base_CommandHandler(RevokeToken_Command) {
  constructor(
    @Inject(USER_TOKEN_REPOSITORY)
    private readonly tokenRepository: UserToken_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: RevokeToken_Command) {
    const userToken = await this.tokenRepository.findByToken(new Token(command.token));
    if (!userToken) {
      return;
    }

    await this.tokenRepository.remove(userToken.id);
  }

  async authorize(_command: RevokeToken_Command) {
    return true;
  }

  async validate(_command: RevokeToken_Command) {}
}
