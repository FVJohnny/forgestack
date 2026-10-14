import { Id, NotFoundException } from '@libs/nestjs-common';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { LastLogin } from '@bc/auth/domain/value-objects';
import { GetSigninActivity_Query } from './get-signin-activity.query';
import { GetSigninActivity_QueryHandler } from './get-signin-activity.query-handler';

describe('GetSigninActivity_QueryHandler', () => {
  const setup = () => {
    const userRepository = new User_InMemoryRepository();
    const handler = new GetSigninActivity_QueryHandler(userRepository);
    return { userRepository, handler };
  };

  it('serializes last login, IPs, and user agents', async () => {
    const { handler, userRepository } = setup();
    const user = User.random({ lastLogin: LastLogin.never() });
    user.recordLogin();
    user.recordIdentity({ ip: '203.0.113.7', userAgent: 'firefox/1.0' });
    await userRepository.save(user);

    const result = await handler.execute(
      new GetSigninActivity_Query({ userId: user.id.toValue() }),
    );

    expect(result.lastLogin).not.toBeNull();
    expect(result.ips.map((entry) => entry.value)).toContain('203.0.113.7');
    expect(result.userAgents.map((entry) => entry.value)).toContain('firefox/1.0');
    expect(result.ips[0].seenCount).toBe(1);
    expect(typeof result.ips[0].lastSeen).toBe('string');
  });

  it('returns a null lastLogin for a user who never logged in', async () => {
    const { handler, userRepository } = setup();
    const user = User.random({ lastLogin: LastLogin.never(), ips: [], userAgents: [] });
    await userRepository.save(user);

    const result = await handler.execute(
      new GetSigninActivity_Query({ userId: user.id.toValue() }),
    );

    expect(result.lastLogin).toBeNull();
    expect(result.ips).toHaveLength(0);
    expect(result.userAgents).toHaveLength(0);
  });

  it('throws NotFound for an unknown user', async () => {
    const { handler } = setup();

    await expect(
      handler.execute(new GetSigninActivity_Query({ userId: Id.random().toValue() })),
    ).rejects.toThrow(NotFoundException);
  });
});
