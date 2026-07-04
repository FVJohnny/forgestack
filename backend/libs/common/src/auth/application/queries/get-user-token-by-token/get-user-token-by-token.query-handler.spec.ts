import { GetUserTokenByToken_QueryHandler } from './get-user-token-by-token.query-handler';
import { GetUserTokenByToken_Query } from './get-user-token-by-token.query';
import { UserToken_InMemoryRepository } from '../../../testing/user-token.in-memory-repository';
import { UserToken } from '../../../domain/entities/user-token.aggregate';
import { Token } from '../../../domain/entities/token.vo';
import { NotFoundException, InfrastructureException } from '../../../../errors/application.exceptions';
import { Id } from '../../../../general/domain/value-objects/id.vo';

describe('GetUserTokenByToken_QueryHandler', () => {
  const createQuery = (overrides: Partial<GetUserTokenByToken_Query> = {}) =>
    new GetUserTokenByToken_Query(overrides.token || Token.random().toValue());

  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const { shouldFailRepository = false } = params;

    const repository = new UserToken_InMemoryRepository(shouldFailRepository);
    const handler = new GetUserTokenByToken_QueryHandler(repository);

    return { repository, handler };
  };

  it('should return the user token DTO when token exists', async () => {
    // Arrange
    const { handler, repository } = setup();
    const userToken = UserToken.create({
      userId: Id.random(),
      token: Token.random(),
      type: 'refresh',
    });
    await repository.save(userToken);

    const query = createQuery({ token: userToken.token.toValue() });

    // Act
    const result = await handler.execute(query);

    // Assert
    expect(result).toBeDefined();
    expect(result).toEqual(userToken.toValue());
  });

  it('should throw NotFoundException when token does not exist', async () => {
    // Arrange
    const { handler } = setup();
    const query = createQuery();

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });

  it('should throw InfrastructureException if repository fails', async () => {
    // Arrange
    const { handler } = setup({ shouldFailRepository: true });
    const query = createQuery();

    // Act & Assert
    await expect(handler.execute(query)).rejects.toThrow(InfrastructureException);
  });
});
