import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { UserRole, UserStatus, UserStatusEnum } from '@bc/auth/domain/value-objects';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { Id, MockEventBus, NotFoundException, UnauthorizedException } from '@libs/nestjs-common';
import { UnsuspendUser_Command } from './unsuspend-user.command';
import { UnsuspendUser_CommandHandler } from './unsuspend-user.command-handler';

describe('UnsuspendUserCommandHandler', () => {
  const setup = () => {
    const userRepository = new User_InMemoryRepository();
    const eventBus = new MockEventBus();
    const commandHandler = new UnsuspendUser_CommandHandler(userRepository, eventBus);
    return { userRepository, eventBus, commandHandler };
  };

  const createAdmin = () => User.random({ role: UserRole.admin(), status: UserStatus.active() });

  const createSuspendedUser = () =>
    User.random({ role: UserRole.user(), status: UserStatus.suspended() });

  describe('Happy Path', () => {
    it('should unsuspend a suspended user back to active', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      const target = createSuspendedUser();
      await userRepository.save(admin);
      await userRepository.save(target);

      await commandHandler.execute(
        new UnsuspendUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToUnsuspend: target.id.toValue(),
        }),
      );

      const updated = await userRepository.findById(target.id);
      expect(updated!.status.toValue()).toBe(UserStatusEnum.ACTIVE);
    });

    it('should update the updatedAt timestamp', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      const target = createSuspendedUser();
      await userRepository.save(admin);
      await userRepository.save(target);
      const originalUpdatedAt = target.timestamps.updatedAt;

      await commandHandler.execute(
        new UnsuspendUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToUnsuspend: target.id.toValue(),
        }),
      );

      const updated = await userRepository.findById(target.id);
      expect(updated!.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should throw UnauthorizedException when requester is not admin', async () => {
      const { commandHandler, userRepository } = setup();
      const regularRequester = User.random({
        role: UserRole.user(),
        status: UserStatus.active(),
      });
      const target = createSuspendedUser();
      await userRepository.save(regularRequester);
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new UnsuspendUser_Command({
            requesterUserId: regularRequester.id.toValue(),
            userIdToUnsuspend: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when requester does not exist', async () => {
      const { commandHandler, userRepository } = setup();
      const target = createSuspendedUser();
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new UnsuspendUser_Command({
            requesterUserId: Id.random().toValue(),
            userIdToUnsuspend: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not modify the user when authorization fails', async () => {
      const { commandHandler, userRepository } = setup();
      const regularRequester = User.random({
        role: UserRole.user(),
        status: UserStatus.active(),
      });
      const target = createSuspendedUser();
      await userRepository.save(regularRequester);
      await userRepository.save(target);

      try {
        await commandHandler.execute(
          new UnsuspendUser_Command({
            requesterUserId: regularRequester.id.toValue(),
            userIdToUnsuspend: target.id.toValue(),
          }),
        );
      } catch {
        // expected
      }

      const unchanged = await userRepository.findById(target.id);
      expect(unchanged!.status.toValue()).toBe(UserStatusEnum.SUSPENDED);
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when target user does not exist', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      await userRepository.save(admin);

      await expect(
        commandHandler.execute(
          new UnsuspendUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToUnsuspend: Id.random().toValue(),
          }),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
