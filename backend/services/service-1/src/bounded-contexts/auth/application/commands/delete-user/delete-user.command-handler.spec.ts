import { UserDeleted_DomainEvent } from '@bc/auth/domain/aggregates/user/events/user-deleted.domain-event';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { UserRole, UserStatus } from '@bc/auth/domain/value-objects';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import {
  Id,
  InfrastructureException,
  InvalidOperationException,
  MockEventBus,
  NotFoundException,
  Outbox_InMemoryRepository,
  UnauthorizedException,
  UserDeleted_IntegrationEvent,
} from '@libs/nestjs-common';
import { DeleteUser_Command } from './delete-user.command';
import { DeleteUser_CommandHandler } from './delete-user.command-handler';

describe('DeleteUserCommandHandler', () => {
  const setup = (params: { shouldFailOutbox?: boolean } = {}) => {
    const userRepository = new User_InMemoryRepository();
    const eventBus = new MockEventBus();
    const outboxRepository = new Outbox_InMemoryRepository(params.shouldFailOutbox ?? false);
    const commandHandler = new DeleteUser_CommandHandler(
      userRepository,
      eventBus,
      outboxRepository,
    );

    return { userRepository, eventBus, outboxRepository, commandHandler };
  };

  const createAdmin = (id?: Id) =>
    User.random({
      id: id || Id.random(),
      role: UserRole.admin(),
      status: UserStatus.active(),
    });

  const createRegularUser = (id?: Id) =>
    User.random({
      id: id || Id.random(),
      role: UserRole.user(),
      status: UserStatus.active(),
    });

  describe('Happy Path', () => {
    it('should delete a regular user when requested by an admin', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      const target = createRegularUser();
      await userRepository.save(admin);
      await userRepository.save(target);

      await commandHandler.execute(
        new DeleteUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToDelete: target.id.toValue(),
        }),
      );

      const deleted = await userRepository.findById(target.id);
      expect(deleted).toBeNull();
    });

    it('should publish the UserDeleted domain event once the user is removed', async () => {
      const { commandHandler, userRepository, eventBus } = setup();
      const admin = createAdmin();
      const target = createRegularUser();
      await userRepository.save(admin);
      await userRepository.save(target);

      await commandHandler.execute(
        new DeleteUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToDelete: target.id.toValue(),
        }),
      );

      const event = eventBus.events.find(
        (e) => e instanceof UserDeleted_DomainEvent,
      ) as UserDeleted_DomainEvent;
      expect(event).toBeInstanceOf(UserDeleted_DomainEvent);
      expect(event.aggregateId.toValue()).toBe(target.id.toValue());
      // Item 121: deletion also revokes the user's tokens (UserLogout event).
      expect(eventBus.events.some((e) => e.constructor.name === 'UserLogout_DomainEvent')).toBe(
        true,
      );
    });
  });

  describe('Atomic UserDeleted integration event', () => {
    it('writes the UserDeleted integration event (with the email) to the outbox', async () => {
      const { commandHandler, userRepository, outboxRepository } = setup();
      const admin = createAdmin();
      const target = createRegularUser();
      await userRepository.save(admin);
      await userRepository.save(target);

      await commandHandler.execute(
        new DeleteUser_Command({
          requesterUserId: admin.id.toValue(),
          userIdToDelete: target.id.toValue(),
        }),
      );

      const outboxEvents = await outboxRepository.findAll();
      expect(outboxEvents).toHaveLength(1);
      expect(outboxEvents[0].eventName.toValue()).toBe(UserDeleted_IntegrationEvent.metadata.name);
      const payload = JSON.parse(outboxEvents[0].payload.toValue());
      expect(payload.userId).toBe(target.id.toValue());
      // Downstream consumers need the email; the user row is gone by then.
      expect(payload.email).toBe(target.email.toValue());
    });

    it('rolls the delete back when the outbox write fails', async () => {
      const { commandHandler, userRepository, outboxRepository, eventBus } = setup({
        shouldFailOutbox: true,
      });
      const admin = createAdmin();
      const target = createRegularUser();
      await userRepository.save(admin);
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToDelete: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(InfrastructureException);

      // Neither the delete nor the event happened, and no in-process cascade ran.
      expect(await userRepository.findById(target.id)).not.toBeNull();
      outboxRepository.shouldFail = false;
      expect(await outboxRepository.findAll()).toHaveLength(0);
      expect(eventBus.events).toHaveLength(0);
    });
  });

  describe('Authorization: Admin-Only Access', () => {
    it('should throw UnauthorizedException when requester is a regular user', async () => {
      const { commandHandler, userRepository } = setup();
      const regularRequester = createRegularUser();
      const target = createRegularUser();
      await userRepository.save(regularRequester);
      await userRepository.save(target);

      await expect(
        commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: regularRequester.id.toValue(),
            userIdToDelete: target.id.toValue(),
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
          new DeleteUser_Command({
            requesterUserId: Id.random().toValue(),
            userIdToDelete: target.id.toValue(),
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
          new DeleteUser_Command({
            requesterUserId: '',
            userIdToDelete: target.id.toValue(),
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Authorization: Self-Deletion Prevention', () => {
    it('should throw InvalidOperationException when admin tries to delete themselves', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      await userRepository.save(admin);

      await expect(
        commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToDelete: admin.id.toValue(),
          }),
        ),
      ).rejects.toThrow(InvalidOperationException);
    });

    it('should not remove the admin from the repository on self-delete attempt', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      await userRepository.save(admin);

      try {
        await commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToDelete: admin.id.toValue(),
          }),
        );
      } catch {
        // expected
      }

      const stillExists = await userRepository.findById(admin.id);
      expect(stillExists).not.toBeNull();
    });
  });

  describe('Authorization: Admin-Deleting-Admin Prevention', () => {
    it('should throw InvalidOperationException when admin tries to delete another admin', async () => {
      const { commandHandler, userRepository } = setup();
      const admin1 = createAdmin();
      const admin2 = createAdmin();
      await userRepository.save(admin1);
      await userRepository.save(admin2);

      await expect(
        commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin1.id.toValue(),
            userIdToDelete: admin2.id.toValue(),
          }),
        ),
      ).rejects.toThrow(InvalidOperationException);
    });

    it('should not remove the target admin from repository', async () => {
      const { commandHandler, userRepository } = setup();
      const admin1 = createAdmin();
      const admin2 = createAdmin();
      await userRepository.save(admin1);
      await userRepository.save(admin2);

      try {
        await commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin1.id.toValue(),
            userIdToDelete: admin2.id.toValue(),
          }),
        );
      } catch {
        // expected
      }

      const stillExists = await userRepository.findById(admin2.id);
      expect(stillExists).not.toBeNull();
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundException when target user does not exist', async () => {
      const { commandHandler, userRepository } = setup();
      const admin = createAdmin();
      await userRepository.save(admin);

      await expect(
        commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToDelete: Id.random().toValue(),
          }),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not publish events when target user does not exist', async () => {
      const { commandHandler, userRepository, eventBus } = setup();
      const admin = createAdmin();
      await userRepository.save(admin);

      try {
        await commandHandler.execute(
          new DeleteUser_Command({
            requesterUserId: admin.id.toValue(),
            userIdToDelete: Id.random().toValue(),
          }),
        );
      } catch {
        // expected
      }

      expect(eventBus.events).toHaveLength(0);
    });
  });
});
