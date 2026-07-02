import { StoreTokens_CommandHandler } from './store-tokens.command-handler';
import { StoreTokens_Command } from './store-tokens.command';
import { UserToken_InMemoryRepository } from '../../../testing/user-token.in-memory-repository';
import { Id } from '../../../../general/domain/value-objects/id.vo';
import { MockEventBus } from '../../../../testing/mock-event-bus';
import { InfrastructureException } from '../../../../errors/application.exceptions';

describe('StoreTokens_CommandHandler', () => {
  const createCommand = (props?: Partial<StoreTokens_Command>) =>
    new StoreTokens_Command({
      userId: props?.userId || Id.random().toValue(),
      accessToken: props?.accessToken || 'access-token-' + Math.random(),
      refreshToken: props?.refreshToken || 'refresh-token-' + Math.random(),
    });

  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const tokenRepository = new UserToken_InMemoryRepository(params.shouldFailRepository);
    const eventBus = new MockEventBus({ shouldFail: false });
    const commandHandler = new StoreTokens_CommandHandler(tokenRepository, eventBus);

    return { tokenRepository, commandHandler };
  };

  it('should successfully store access and refresh tokens', async () => {
    const { commandHandler, tokenRepository } = setup();
    const command = createCommand();

    await commandHandler.execute(command);

    const storedTokens = await tokenRepository.getUserTokens(new Id(command.userId));
    expect(storedTokens).toHaveLength(2);

    const accessToken = storedTokens.find((t) => t.type.toValue() === 'access');
    const refreshToken = storedTokens.find((t) => t.type.toValue() === 'refresh');

    expect(accessToken?.token.toValue()).toBe(command.accessToken);
    expect(refreshToken?.token.toValue()).toBe(command.refreshToken);
  });

  it('should throw InfrastructureException when repository fails', async () => {
    const { commandHandler } = setup({ shouldFailRepository: true });
    const command = createCommand();

    await expect(commandHandler.execute(command)).rejects.toThrow(InfrastructureException);
  });
});
