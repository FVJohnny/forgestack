import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { UserRole, UserStatus, UserStatusEnum } from '@bc/auth/domain/value-objects';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { Id, MockEventBus, NotFoundException, UnauthorizedException } from '@libs/nestjs-common';
import { SuspendUser_Command } from './suspend-user.command';
import { SuspendUser_CommandHandler } from './suspend-user.command-handler';

describe('SuspendUserCommandHandler', () => {
  const setup = () => {
    const userRepository = new User_InMemoryRepository();
    const eventBus = new MockEventBus();
    const commandHandler = new SuspendUser_CommandHandler(userRepository, eventBus);
    return { userRepository, eventBus, commandHandler };
  };

  const createAdmin = () => User.random({ role: UserRole.admin(), status: UserStatus.active() });

  const createRegularUser = (status?: UserStatus) =>
    User.random({ role: UserRole.user(), status: status || UserStatus.active() });

  describe('Happy Path', () => {
    it('should suspend an active user', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      const target = createRegularUser();
      await userRepository.save(admin);
      await userRepository.save(target);

      await commandHandler.execute(
        new SuspendUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToSuspend: target.id.toValue(),
        }),
      );

      const updated = await userRepository.findById(target.id);
      expect(updated!.status.toValue()).toBe(UserStatusEnum.SUSPENDED);
    });

    it('should update the updatedAt timestamp', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      const target = createRegularUser();
      await userRepository.save(admin);
      await userRepository.save(target);
      const originalUpdatedAt = target.timestamps.updatedAt;

      await commandHandler.execute(
        new SuspendUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToSuspend: target.id.toValue(),
        }),
      );

      const updated = await userRepository.findById(target.id);
      expect(updated!.timestamps.updatedAt.isAfter(originalUpdatedAt)).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should throw UnauthorizedException when requester is not admin', async () => {
      const { commandHandler, userRepository } = setup();
      const regularRequester = createRegularUser();
      const target = createRegularUser();
      await userRepository.save(regularRequester);
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new SuspendUser_Command({
            requesterUserId: regularRequester.id.toValue(),
            userIdToSuspend: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when requester does not exist', async () => {
      const { commandHandler, userRepository } = setup();
      const target = createRegularUser();
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new SuspendUser_Command({
            requesterUserId: Id.random().toValue(),
            userIdToSuspend: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when requesterUserId is empty', async () => {
      const { commandHandler, userRepository } = setup();
      const target = createRegularUser();
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new SuspendUser_Command({
            requesterUserId: '',
            userIdToSuspend: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when target user does not exist', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      await userRepository.save(admin);

      await expect(
        commandHandler.execute(
          new SuspendUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToSuspend: Id.random().toValue(),
          }),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
