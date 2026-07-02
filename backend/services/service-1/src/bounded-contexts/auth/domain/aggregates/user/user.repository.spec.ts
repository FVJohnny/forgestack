import type { User_Repository } from './user.repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { Email, LastLogin, UserRole } from '@bc/auth/domain/value-objects';
import {
  Criteria,
  Filters,
  Filter,
  FilterField,
  FilterOperator,
  FilterValue,
  Order,
  OrderBy,
  OrderType,
  OrderTypes,
  Operator,
  PaginationOffset,
  Id,
  DateVO,
  AlreadyExistsException,
} from '@libs/nestjs-common';

/**
 * Basic validation test to prevent Jest "no tests found" error
 */
describe('UserRepository Contract Test Suite', () => {
  it('exports testUserRepositoryContract function', () => {
    expect(typeof testUserRepositoryContract).toBe('function');
  });
});

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
  const setup = async ({ numUsers = 0 }: { numUsers?: number }) => {
    const repository = await createRepository();
    const users = Array.from({ length: numUsers }).map(() => User.random());
    for (const user of users) {
      await repository.save(user);
    }
    return { repository, users };
  };

  describe(`UserRepository Contract: ${description}`, () => {
    if (setupTeardown?.beforeAll) {
      beforeAll(setupTeardown.beforeAll, 30000);
    }

    if (setupTeardown?.afterAll) {
      afterAll(setupTeardown.afterAll, 30000);
    }

    if (setupTeardown?.beforeEach) {
      beforeEach(setupTeardown.beforeEach);
    }

    if (setupTeardown?.afterEach) {
      afterEach(setupTeardown.afterEach);
    }

    describe('Basic CRUD Operations', () => {
      describe('save', () => {
        it('should save a new user successfully', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          const savedUser = await repository.findById(users[0].id);
          expect(savedUser).not.toBeNull();
          expect(savedUser?.equals(users[0])).toBe(true);
        });

        it('should update an existing user when saving with same id', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          users[0].changeRole(UserRole.admin());
          await repository.save(users[0]);

          const savedUser = await repository.findById(users[0].id);
          const allSavedUsers = await repository.findAll();

          expect(savedUser).not.toBeNull();
          expect(savedUser!.role.equals(UserRole.admin())).toBe(true);
          expect(allSavedUsers).toHaveLength(1);
        });

        it('should save multiple users', async () => {
          const { repository, users } = await setup({ numUsers: 10 });

          const allSavedUsers = await repository.findAll();
          expect(allSavedUsers).toHaveLength(users.length);
          users.forEach((user) => {
            const savedUser = allSavedUsers.find((u) => u.id.toValue() === user.id.toValue());
            expect(savedUser).toBeDefined();
            expect(savedUser?.equals(user)).toBe(true);
          });
        });

        it('should throw AlreadyExistsException on email collision', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          // Create a new user with the same email but different ID
          const duplicateEmailUser = User.random({
            email: users[0].email,
          });

          await expect(repository.save(duplicateEmailUser)).rejects.toThrow(AlreadyExistsException);
        });
      });

      describe('findById', () => {
        it('should return user when it exists', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          const result = await repository.findById(users[0].id);

          expect(result).not.toBeNull();
          expect(result!.equals(users[0])).toBe(true);
        });

        it('should return null when user does not exist', async () => {
          const { repository } = await setup({ numUsers: 0 });
          const result = await repository.findById(Id.random());

          expect(result).toBeNull();
        });
      });

      describe('findByEmail', () => {
        it('should return user when email exists', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          const result = await repository.findByEmail(users[0].email);

          expect(result).not.toBeNull();
          expect(result!.equals(users[0])).toBe(true);
        });

        it('should return null when email does not exist', async () => {
          const { repository } = await setup({ numUsers: 0 });
          const result = await repository.findByEmail(Email.random());

          expect(result).toBeNull();
        });
      });

      describe('existsByEmail', () => {
        it('should return true when email exists', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          const result = await repository.existsByEmail(users[0].email);

          expect(result).toBe(true);
        });

        it('should return false when email does not exist', async () => {
          const { repository } = await setup({ numUsers: 0 });
          const result = await repository.existsByEmail(Email.random());

          expect(result).toBe(false);
        });
      });

      describe('exists', () => {
        it('should return true when user exists', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          const result = await repository.exists(users[0].id);

          expect(result).toBe(true);
        });

        it('should return false when user does not exist', async () => {
          const { repository } = await setup({ numUsers: 0 });

          const result = await repository.exists(Id.random());

          expect(result).toBe(false);
        });
      });

      describe('remove', () => {
        it('should remove an existing user', async () => {
          const { repository, users } = await setup({ numUsers: 1 });

          expect(await repository.exists(users[0].id)).toBe(true);
          expect(await repository.findById(users[0].id)).not.toBeNull();

          await repository.remove(users[0].id);

          expect(await repository.exists(users[0].id)).toBe(false);
          expect(await repository.findById(users[0].id)).toBeNull();
        });

        it('should handle removal of non-existent user gracefully', async () => {
          const { repository } = await setup({ numUsers: 0 });
          await expect(repository.remove(Id.random())).resolves.not.toThrow();
        });
      });

      describe('findAll', () => {
        it('should return all users', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });

          // Act
          const results = await repository.findAll();

          // Assert
          expect(results).toHaveLength(users.length);
          users.forEach((user) => {
            const result = results.find((r) => r.id.toValue() === user.id.toValue());
            expect(result).toBeDefined();
            expect(result!.equals(user)).toBe(true);
          });
        });

        it('should return empty array when no users exist', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 0 });

          // Act
          const result = await repository.findAll();

          // Assert
          expect(result).toHaveLength(0);
          expect(result).toEqual([]);
        });
      });
    });

    describe('Criteria-based Operations', () => {
      describe('findByCriteria - Basic Filtering', () => {
        it('should return all users when no filters applied', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const criteria = new Criteria();

          const result = await repository.findByCriteria(criteria);

          expect(result.data).toHaveLength(users.length);
        });

        it('should filter by id (EQUAL)', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('id'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(users[0].id.toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          const result = await repository.findByCriteria(criteria);

          expect(result.data).toHaveLength(1);
          expect(result.data[0].equals(users[0])).toBe(true);
        });

        it('should filter by email (EQUAL)', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(users[0].email.toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          const result = await repository.findByCriteria(criteria);

          expect(result.data).toHaveLength(1);
          expect(result.data[0].equals(users[0])).toBe(true);
        });

        it('should filter by status (EQUAL)', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const status = users[0].status;
          const filter = new Filter(
            new FilterField('status'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(status.toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          const result = await repository.findByCriteria(criteria);
          const numUsersWithStatus = users.filter((user) => user.status.equals(status)).length;

          expect(result.data).toHaveLength(numUsersWithStatus);
          expect(result.data[0].equals(users[0])).toBe(true);
        });

        it('should filter by role (EQUAL)', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const role = users[0].role;
          const filter = new Filter(
            new FilterField('role'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(role.toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          const result = await repository.findByCriteria(criteria);
          const numUsersWithRole = users.filter((user) => user.role.equals(role)).length;

          expect(result.data).toHaveLength(numUsersWithRole);
          expect(result.data[0].equals(users[0])).toBe(true);
        });
      });

      describe('findByCriteria - Advanced Filtering', () => {
        it('should filter with NOT_EQUAL operator', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.NOT_EQUAL),
            new FilterValue(users[0].email.toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          const result = await repository.findByCriteria(criteria);

          expect(result.data).toHaveLength(users.length - 1);
          expect(
            result.data.every(
              (resultUser) => resultUser.email.toValue() !== users[0].email.toValue(),
            ),
          ).toBe(true);
        });

        it('should filter with CONTAINS operator (case-insensitive)', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const emailSubstring = users[0].email.toValue().substring(0, 5);
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.CONTAINS),
            new FilterValue(emailSubstring),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          const usersWithSubstring = users.filter((user) =>
            user.email.toValue().toLowerCase().includes(emailSubstring),
          );
          const result = await repository.findByCriteria(criteria);

          expect(result.data).toHaveLength(usersWithSubstring.length);
          usersWithSubstring.forEach((user) => {
            const userInResult = result.data.find((r) => r.id.toValue() === user.id.toValue());
            expect(userInResult).toBeDefined();
            expect(userInResult!.equals(user)).toBe(true);
          });
        });

        it('should filter with NOT_CONTAINS operator', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          const emailSubstring = users[0].email.toValue().substring(0, 3);
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.NOT_CONTAINS),
            new FilterValue(emailSubstring),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          // Act
          const usersWithoutSubstring = users.filter(
            (user) => !user.email.toValue().includes(emailSubstring),
          );
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(usersWithoutSubstring.length);
          usersWithoutSubstring.forEach((user) => {
            const userInResult = result.data.find((r) => r.id.toValue() === user.id.toValue());
            expect(userInResult).toBeDefined();
            expect(userInResult!.equals(user)).toBe(true);
          });
        });

        it('should filter with date fields using GT operator', async () => {
          const { repository, users } = await setup({ numUsers: 25 });
          // Arrange. User.random() buckets createdAt at whole-day offsets from
          // "now"; pick a half-day pivot so no user can land exactly on it when
          // the system clock returns the same ms for sequential `new Date()`
          // calls (which would make `<` and `>` both false for a tied user).
          const pastDate = DateVO.dateVOAtDaysFromNow(-30.5);
          const filter = new Filter(
            new FilterField('createdAt'),
            new FilterOperator(Operator.GT),
            new FilterValue(pastDate.toValue().toISOString()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
            pagination: new PaginationOffset(users.length, 0),
          });

          // Act
          const result = await repository.findByCriteria(criteria);
          const usersNotInResult = users.filter(
            (user) => !result.data.some((r) => r.id.toValue() === user.id.toValue()),
          );

          // Assert
          expect(result.data.every((user) => user.timestamps.createdAt.isAfter(pastDate))).toBe(
            true,
          );
          expect(
            usersNotInResult.every((user) => user.timestamps.createdAt.isBefore(pastDate)),
          ).toBe(true);
        });

        it('should filter with date fields using LT operator', async () => {
          // Arrange. Half-day pivot — see GT test above for why integer days
          // would be flaky.
          const { repository, users } = await setup({ numUsers: 10 });
          const pastDate = DateVO.dateVOAtDaysFromNow(-30.5);
          const filter = new Filter(
            new FilterField('createdAt'),
            new FilterOperator(Operator.LT),
            new FilterValue(pastDate.toValue().toISOString()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          // Act
          const result = await repository.findByCriteria(criteria);
          const usersNotInResult = users.filter(
            (user) => !result.data.some((r) => r.id.toValue() === user.id.toValue()),
          );

          // Assert
          expect(result.data.every((user) => user.timestamps.createdAt.isBefore(pastDate))).toBe(
            true,
          );
          expect(
            usersNotInResult.every((user) => user.timestamps.createdAt.isAfter(pastDate)),
          ).toBe(true);
        });

        it('should combine multiple filters (AND logic)', async () => {
          const { repository, users } = await setup({ numUsers: 10 });
          // Arrange
          const emailSubstring = users[0].email.toValue().substring(0, 5);
          const filters = [
            new Filter(
              new FilterField('email'),
              new FilterOperator(Operator.CONTAINS),
              new FilterValue(emailSubstring),
            ),
            new Filter(
              new FilterField('role'),
              new FilterOperator(Operator.EQUAL),
              new FilterValue(users[0].role.toValue()),
            ),
          ];
          const criteria = new Criteria({
            filters: new Filters(filters),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data.length).toBeGreaterThanOrEqual(1);
          expect(result.data.some((u) => u.equals(users[0]))).toBe(true);
        });

        it('should return empty array when no matches found', async () => {
          const { repository } = await setup({ numUsers: 10 });
          // Arrange
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(Email.random().toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(0);
        });
      });

      describe('findByCriteria - Sorting', () => {
        it('should sort by email ascending', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });
          const order = new Order(new OrderBy('email'), new OrderType(OrderTypes.ASC));
          const criteria = new Criteria({ order });

          // Act
          const result = await repository.findByCriteria(criteria);
          const usersSorted = users.sort((a, b) =>
            a.email.toValue().localeCompare(b.email.toValue()),
          );

          // Assert
          for (let i = 0; i < usersSorted.length; i++) {
            expect(result.data[i].equals(usersSorted[i])).toBe(true);
          }
        });

        it('should handle sorting with lastLogin never', async () => {
          const { repository } = await setup({ numUsers: 9 });
          // Add extra user with who never logged in
          const userNeverLogged = User.random({
            lastLogin: LastLogin.never(),
          });
          await repository.save(userNeverLogged);

          const order = new Order(new OrderBy('lastLogin'), new OrderType(OrderTypes.ASC));
          const criteria = new Criteria({ order });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(10);
          expect(result.data[0].lastLogin.isNever()).toBe(true); // Never = First when orderType = ASC
        });
      });

      describe('findByCriteria - Pagination', () => {
        it('should apply limit', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(2, 0),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(2);
          expect(result.data[0].equals(users[0])).toBe(true);
          expect(result.data[1].equals(users[1])).toBe(true);
        });

        it('should apply offset', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(0, 1),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(9);
          for (let i = 0; i < 9; i++) {
            expect(result.data[i].equals(users[i + 1])).toBe(true);
          }
        });

        it('should combine limit and offset', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(1, 1),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(1);
          expect(result.data[0].equals(users[1])).toBe(true);
        });

        it('should handle offset larger than collection size', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(10, 50),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(0);
        });

        it('should handle limit larger than remaining items', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(25, 2),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(8);
          for (let i = 0; i < 8; i++) {
            expect(result.data[i].equals(users[i + 2])).toBe(true);
          }
        });
      });

      describe('findByCriteria - withTotal functionality', () => {
        it('should return null total when withTotal is false (default)', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria();

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(10);
          expect(result.total).toBeNull();
        });

        it('should return total count when withTotal is true', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(0, 0, true),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(10);
          expect(result.total).toBe(10);
        });

        it('should return correct total with pagination (limit only)', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(2, 0, true),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(2);
          expect(result.total).toBe(10);
        });

        it('should return correct total with pagination (offset only)', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(0, 2, true),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(8);
          expect(result.total).toBe(10);
        });

        it('should return correct total with pagination (limit and offset)', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria({
            pagination: new PaginationOffset(1, 1, true),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(1);
          expect(result.total).toBe(10);
        });

        it('should return correct total with filters and pagination', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.CONTAINS),
            new FilterValue('@'),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
            pagination: new PaginationOffset(1, 0, true),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(1); // Limited to 1
          expect(result.total).toBe(10); // Total matching the filter (user1 and user2)
        });

        it('should return zero total when no records match filter', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(Email.random().toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
            pagination: new PaginationOffset(0, 0, true),
          });

          // Act
          const result = await repository.findByCriteria(criteria);

          // Assert
          expect(result.data).toHaveLength(0);
          expect(result.total).toBe(0);
        });
      });

      describe('countByCriteria', () => {
        it('should count all users when no filters applied', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const criteria = new Criteria();

          // Act
          const result = await repository.countByCriteria(criteria);

          // Assert
          expect(result).toBe(10);
        });

        it('should count filtered users', async () => {
          // Arrange
          const { repository, users } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(users[0].email.toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          // Act
          const result = await repository.countByCriteria(criteria);

          // Assert
          expect(result).toBe(1);
        });

        it('should return 0 when no matches found', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.EQUAL),
            new FilterValue(Email.random().toValue()),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
          });

          // Act
          const result = await repository.countByCriteria(criteria);

          // Assert
          expect(result).toBe(0);
        });

        it('should ignore pagination in count', async () => {
          // Arrange
          const { repository } = await setup({ numUsers: 10 });
          const filter = new Filter(
            new FilterField('email'),
            new FilterOperator(Operator.CONTAINS),
            new FilterValue('@'),
          );
          const criteria = new Criteria({
            filters: new Filters([filter]),
            pagination: new PaginationOffset(1, 1),
          });

          // Act
          const count = await repository.countByCriteria(criteria);
          const results = await repository.findByCriteria(criteria);

          // Assert
          expect(count).toBe(10); // Total matching records
          expect(results.data).toHaveLength(1); // After pagination
        });
      });
    });
  });
}
