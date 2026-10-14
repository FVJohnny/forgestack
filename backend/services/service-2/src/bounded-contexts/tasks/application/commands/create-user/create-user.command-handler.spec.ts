import { Id, MockEventBus } from '@libs/nestjs-common';
import { User_InMemoryRepository } from '@bc/tasks/infrastructure/repositories/in-memory/user.in-memory-repository';
import { CreateUser_Command } from './create-user.command';
import { CreateUser_CommandHandler } from './create-user.command-handler';

describe('CreateUser_CommandHandler (tasks projection)', () => {
  const setup = (params: { shouldFailRepository?: boolean } = {}) => {
    const userRepository = new User_InMemoryRepository(params.shouldFailRepository);
    const eventBus = new MockEventBus();
    const handler = new CreateUser_CommandHandler(userRepository, eventBus);
    return { userRepository, handler };
  };

  it('creates the local user projection', async () => {
    const { handler, userRepository } = setup();
    const userId = Id.random().toValue();

    await handler.execute(new CreateUser_Command(userId, 'new-user@example.com'));

    const stored = await userRepository.findById(new Id(userId));
    expect(stored).not.toBeNull();
    expect(stored!.email.toValue()).toBe('new-user@example.com');
  });

  it('is idempotent: the same event delivered twice leaves exactly one projection', async () => {
    // The inbox is at-least-once, so redelivery of user.created must not fail
    // or duplicate.
    const { handler, userRepository } = setup();
    const userId = Id.random().toValue();
    const command = new CreateUser_Command(userId, 'again@example.com');

    await handler.execute(command);
    await expect(handler.execute(command)).resolves.not.toThrow();

    expect(await userRepository.findAll()).toHaveLength(1);
  });

  it('propagates repository failures', async () => {
    const { handler } = setup({ shouldFailRepository: true });

    await expect(
      handler.execute(new CreateUser_Command(Id.random().toValue(), 'boom@example.com')),
    ).rejects.toThrow();
  });
});
