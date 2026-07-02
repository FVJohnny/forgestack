import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { StoreTokens_Command } from './store-tokens.command';
import {
  USER_TOKEN_REPOSITORY,
  type UserToken_Repository,
} from '../../../domain/repositories/user-token.repository';
import { Base_CommandHandler } from '../../../../cqrs/base.command-handler';
import { EVENT_BUS } from '../../../../cqrs/cqrs.module';
import { Id } from '../../../../general/domain/value-objects/id.vo';
import { Transaction } from '../../../../transactions/transaction';
import { UserToken } from '../../../domain/entities/user-token.aggregate';
import { Token } from '../../../domain/entities/token.vo';

export class StoreTokens_CommandHandler extends Base_CommandHandler(StoreTokens_Command) {
  constructor(
    @Inject(USER_TOKEN_REPOSITORY)
    private readonly tokenRepository: UserToken_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: StoreTokens_Command) {
    const accessToken = UserToken.create({
      token: new Token(command.accessToken),
      userId: new Id(command.userId),
      type: 'access',
    });
    const refreshToken = UserToken.create({
      token: new Token(command.refreshToken),
      userId: new Id(command.userId),
      type: 'refresh',
    });

    await Transaction.run(async (context) => {
      await this.tokenRepository.save(accessToken, context);
      await this.tokenRepository.save(refreshToken, context);
    });
  }

  async authorize(_command: StoreTokens_Command) {
    return true;
  }

  async validate(_command: StoreTokens_Command) {}
}
