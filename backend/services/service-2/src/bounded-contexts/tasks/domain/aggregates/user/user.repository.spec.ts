import type { User_Repository } from './user.repository';
import { User } from '@bc/tasks/domain/aggregates/user/user.aggregate';
import { Email } from '@bc/tasks/domain/value-objects';
import {
  Criteria,
  Filter,
  FilterField,
  FilterOperator,
  Filters,
  FilterValue,
  Id,
  Operator,
  Transaction,
} from '@libs/nestjs-common';

/**
 * Basic validation test to prevent Jest "no tests found" error
 */
describe('UserRepository (tasks projection) Contract Test Suite', () => {
  it('exports testUserRepositoryContract function', () => {
    expect(typeof testUserRepositoryContract).toBe('function');
  });
});

/**
 * Contract for the tasks context's local user projection (built from the
 * UserCreated/UserDeleted integration events). Creating a task checks the user
 * exists here, and the user.deleted cascade removes it in the same transaction
 * as the user's tasks.
 */
export function testUserRepositoryContract(
  description: string,
  createRepository: () => Promise<User_Repository>,
  setupTeardown?: {
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  },
) {
  describe(`UserRepository (tasks projection) Contract: ${description}`, () => {
    let repository: User_Repository;

    if (setupTeardown?.beforeAll) {
      beforeAll(setupTeardown.beforeAll, 30000);
    }

    if (setupTeardown?.afterAll) {
      afterAll(setupTeardown.afterAll, 30000);
    }

    beforeEach(async () => {
      if (setupTeardown?.beforeEach) {
        await setupTeardown.beforeEach();
      }
      repository = await createRepository();
    });

    if (setupTeardown?.afterEach) {
      afterEach(setupTeardown.afterEach);
    }

    describe('save', () => {
      it('should save a new user with every field', async () => {
        const user = User.random();

        await repository.save(user);

        const saved = await repository.findById(user.id);
        expect(saved).not.toBeNull();
        expect(saved!.toValue()).toEqual(user.toValue());
      });

      it('should be idempotent for a replayed UserCreated (same id saved twice)', async () => {
        const user = User.random();
        await repository.save(user);

        await repository.save(user);

        expect(await repository.countByCriteria(new Criteria())).toBe(1);
      });
    });

    describe('findById / exists', () => {
      it('should return null / false for an unknown user', async () => {
        const id = Id.random();
        expect(await repository.findById(id)).toBeNull();
        expect(await repository.exists(id)).toBe(false);
      });

      it('should report a stored user as existing', async () => {
        const user = User.random();
        await repository.save(user);

        expect(await repository.exists(user.id)).toBe(true);
      });
    });

    describe('findByCriteria', () => {
      it('should filter by email', async () => {
        const user = User.random({ email: new Email('projection@example.com') });
        await repository.save(user);
        await repository.save(User.random());

        const result = await repository.findByCriteria(
          new Criteria({
            filters: new Filters([
              new Filter(
                new FilterField('email'),
                new FilterOperator(Operator.EQUAL),
                new FilterValue('projection@example.com'),
              ),
            ]),
          }),
        );

        expect(result.data.map((found) => found.id.toValue())).toEqual([user.id.toValue()]);
      });
    });

    describe('remove', () => {
      it('should remove only the given user', async () => {
        const user = User.random();
        const other = User.random();
        await repository.save(user);
        await repository.save(other);

        await repository.remove(user.id);

        expect(await repository.exists(user.id)).toBe(false);
        expect(await repository.exists(other.id)).toBe(true);
      });

      it('should handle removal of a non-existent user gracefully', async () => {
        await expect(repository.remove(Id.random())).resolves.not.toThrow();
      });

      it('should be rolled back with the surrounding transaction', async () => {
        const user = User.random();
        await repository.save(user);

        await expect(
          Transaction.run(async (context) => {
            await repository.remove(user.id, context);
            throw new Error('abort');
          }),
        ).rejects.toThrow('abort');

        expect(await repository.exists(user.id)).toBe(true);
      });
    });
  });
}
