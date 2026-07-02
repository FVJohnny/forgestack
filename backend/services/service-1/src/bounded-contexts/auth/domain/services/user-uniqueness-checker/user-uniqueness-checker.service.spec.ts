import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { Email, UserRole, UserStatus } from '@bc/auth/domain/value-objects';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { UserUniquenessChecker } from './user-uniqueness-checker.service';

describe('UserUniquenessChecker', () => {
  const setup = () => {
    const userRepository = new User_InMemoryRepository();
    const checker = new UserUniquenessChecker(userRepository);
    return { userRepository, checker };
  };

  it('should return true when no user exists with the given email', async () => {
    const { checker } = setup();

    const result = await checker.isEmailUnique(Email.random());

    expect(result).toBe(true);
  });

  it('should return false when a user already exists with the given email', async () => {
    const { userRepository, checker } = setup();
    const email = Email.random();
    const existingUser = User.random({
      email,
      role: UserRole.user(),
      status: UserStatus.active(),
    });
    await userRepository.save(existingUser);

    const result = await checker.isEmailUnique(email);

    expect(result).toBe(false);
  });

  it('should return true for a different email when other users exist', async () => {
    const { userRepository, checker } = setup();
    const existingUser = User.random({
      role: UserRole.user(),
      status: UserStatus.active(),
    });
    await userRepository.save(existingUser);

    const result = await checker.isEmailUnique(Email.random());

    expect(result).toBe(true);
  });
});
