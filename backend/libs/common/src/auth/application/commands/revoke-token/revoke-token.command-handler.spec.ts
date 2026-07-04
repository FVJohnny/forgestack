import { RevokeToken_CommandHandler } from './revoke-token.command-handler';
import { RevokeToken_Command } from './revoke-token.command';
import { StoreTokens_CommandHandler } from '../store-tokens/store-tokens.command-handler';
import { StoreTokens_Command } from '../store-tokens/store-tokens.command';
import { UserToken_InMemoryRepository } from '../../../testing/user-token.in-memory-repository';
import { Id } from '../../../../general/domain/value-objects/id.vo';
import { Token } from '../../../domain/entities/token.vo';
import { MockEventBus } from '../../../../testing/mock-event-bus';
import { InfrastructureException } from '../../../../errors/application.exceptions';

describe('RevokeToken_CommandHandler', () => {
  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const tokenRepository = new UserToken_InMemoryRepository(params.shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: false });
    const revokeHandler = new RevokeToken_CommandHandler(tokenRepository, eventBus);
    const storeHandler = new StoreTokens_CommandHandler(tokenRepository, eventBus);

    return { tokenRepository, revokeHandler, storeHandler };
  };

  it('should revoke a stored refresh token, leaving other tokens intact', async () => {
    const { tokenRepository, revokeHandler, storeHandler } = setup();
    const userId = Id.random().toValue();
    const storeCommand = new StoreTokens_Command({
      userId,
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
    });
    await storeHandler.execute(storeCommand);

    await revokeHandler.execute(new RevokeToken_Command({ token: 'refresh-token-1' }));

    expect(await tokenRepository.findByToken(new Token('refresh-token-1'))).toBeNull();
    expect(await tokenRepository.findByToken(new Token('access-token-1'))).not.toBeNull();
  });

  it('should be a no-op for a token that does not exist', async () => {
    const { revokeHandler } = setup();

    await expect(
      revokeHandler.execute(new RevokeToken_Command({ token: 'unknown-token' })),
    ).resolves.not.toThrow();
  });

  it('should throw InfrastructureException when repository fails', async () => {
    const { revokeHandler } = setup({ shouldFailRepository: true });

    await expect(
      revokeHandler.execute(new RevokeToken_Command({ token: 'some-token' })),
    ).rejects.toThrow(InfrastructureException);
  });
});
