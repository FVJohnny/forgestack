import type { Task_Repository } from './task.repository';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { TaskTitle } from '@bc/tasks/domain/value-objects';
import {
  Criteria,
  DateVO,
  Filter,
  FilterField,
  FilterOperator,
  Filters,
  FilterValue,
  Id,
  Operator,
  Order,
  OrderTypes,
  PaginationOffset,
  Timestamps,
  Transaction,
} from '@libs/nestjs-common';

/**
 * Basic validation test to prevent Jest "no tests found" error
 */
describe('TaskRepository Contract Test Suite', () => {
  it('exports testTaskRepositoryContract function', () => {
    expect(typeof testTaskRepositoryContract).toBe('function');
  });
});

export function testTaskRepositoryContract(
  description: string,
  createRepository: () => Promise<Task_Repository>,
  setupTeardown?: {
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  },
) {
  const at = (iso: string) => new Timestamps(new DateVO(new Date(iso)), new DateVO(new Date(iso)));

  const ownedBy = (userId: Id) =>
    new Filter(
      new FilterField('userId'),
      new FilterOperator(Operator.EQUAL),
      new FilterValue(userId.toValue()),
    );

  const isCompleted = (completed: boolean) =>
    new Filter(
      new FilterField('completed'),
      new FilterOperator(Operator.EQUAL),
      new FilterValue(completed),
    );

  describe(`TaskRepository Contract: ${description}`, () => {
    let repository: Task_Repository;

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

    describe('Basic CRUD Operations', () => {
      describe('save', () => {
        it('should save a new task with every field', async () => {
          const task = Task.random({ completed: false });

          await repository.save(task);

          const saved = await repository.findById(task.id);
          expect(saved).not.toBeNull();
          expect(saved!.toValue()).toEqual(task.toValue());
        });

        it('should update an existing task when saving with the same id', async () => {
          const task = Task.random({ completed: false });
          await repository.save(task);

          task.complete();
          await repository.save(task);

          const saved = await repository.findById(task.id);
          expect(saved!.completed).toBe(true);
          const all = await repository.findByCriteria(
            new Criteria({ filters: new Filters([ownedBy(task.userId)]) }),
          );
          expect(all.data).toHaveLength(1);
        });
      });

      describe('findById', () => {
        it('should return null when the task does not exist', async () => {
          expect(await repository.findById(Id.random())).toBeNull();
        });
      });

      describe('exists', () => {
        it('should reflect whether the task is stored', async () => {
          const task = Task.random();
          expect(await repository.exists(task.id)).toBe(false);

          await repository.save(task);

          expect(await repository.exists(task.id)).toBe(true);
        });
      });

      describe('remove', () => {
        it('should remove only the given task', async () => {
          const task = Task.random();
          const other = Task.random({ userId: task.userId });
          await repository.save(task);
          await repository.save(other);

          await repository.remove(task.id);

          expect(await repository.findById(task.id)).toBeNull();
          expect(await repository.findById(other.id)).not.toBeNull();
        });

        it('should handle removal of a non-existent task gracefully', async () => {
          await expect(repository.remove(Id.random())).resolves.not.toThrow();
        });
      });
    });

    describe('Criteria-based Operations', () => {
      it("should list one user's tasks newest first with the real total", async () => {
        const me = Id.random();
        const oldest = Task.random({ userId: me, timestamps: at('2026-01-01T10:00:00.000Z') });
        const middle = Task.random({ userId: me, timestamps: at('2026-01-02T10:00:00.000Z') });
        const newest = Task.random({ userId: me, timestamps: at('2026-01-03T10:00:00.000Z') });
        for (const task of [middle, oldest, newest, Task.random()]) {
          await repository.save(task);
        }

        const result = await repository.findByCriteria(
          new Criteria({
            filters: new Filters([ownedBy(me)]),
            order: Order.fromValues('createdAt', OrderTypes.DESC),
            pagination: new PaginationOffset(2, 0, true),
          }),
        );

        expect(result.data.map((task) => task.id.toValue())).toEqual([
          newest.id.toValue(),
          middle.id.toValue(),
        ]);
        // total counts past the page limit.
        expect(result.total).toBe(3);
      });

      it('should count open tasks of one user by the completed flag', async () => {
        const me = Id.random();
        await repository.save(Task.random({ userId: me, completed: false }));
        await repository.save(Task.random({ userId: me, completed: false }));
        await repository.save(Task.random({ userId: me, completed: true }));
        await repository.save(Task.random({ completed: false }));

        const open = await repository.countByCriteria(
          new Criteria({ filters: new Filters([ownedBy(me), isCompleted(false)]) }),
        );
        const done = await repository.countByCriteria(
          new Criteria({ filters: new Filters([ownedBy(me), isCompleted(true)]) }),
        );

        expect(open).toBe(2);
        expect(done).toBe(1);
      });

      it('should keep the title round-trip intact', async () => {
        const task = Task.random({ title: new TaskTitle('Buy milk & eggs') });
        await repository.save(task);

        const saved = await repository.findById(task.id);
        expect(saved!.title.toValue()).toBe('Buy milk & eggs');
      });
    });

    describe('deleteByUserId', () => {
      it("should delete every task of the user and leave other users' tasks", async () => {
        const me = Id.random();
        const someoneElse = Id.random();
        const mine = [Task.random({ userId: me }), Task.random({ userId: me, completed: true })];
        const theirs = Task.random({ userId: someoneElse });
        for (const task of [...mine, theirs]) {
          await repository.save(task);
        }

        await repository.deleteByUserId(me);

        for (const task of mine) {
          expect(await repository.findById(task.id)).toBeNull();
        }
        expect(await repository.findById(theirs.id)).not.toBeNull();
        expect(
          await repository.countByCriteria(new Criteria({ filters: new Filters([ownedBy(me)]) })),
        ).toBe(0);
      });

      it('should be a no-op for a user without tasks', async () => {
        const task = Task.random();
        await repository.save(task);

        await expect(repository.deleteByUserId(Id.random())).resolves.not.toThrow();

        expect(await repository.findById(task.id)).not.toBeNull();
      });

      it('should commit with the surrounding transaction', async () => {
        const me = Id.random();
        const task = Task.random({ userId: me });
        await repository.save(task);

        await Transaction.run(async (context) => {
          await repository.deleteByUserId(me, context);
        });

        expect(await repository.findById(task.id)).toBeNull();
      });

      it('should be rolled back with the surrounding transaction', async () => {
        const me = Id.random();
        const task = Task.random({ userId: me });
        await repository.save(task);

        await expect(
          Transaction.run(async (context) => {
            await repository.deleteByUserId(me, context);
            throw new Error('abort');
          }),
        ).rejects.toThrow('abort');

        // The user.deleted cascade relies on this: a failed cascade must not
        // leave the tasks half-deleted.
        expect(await repository.findById(task.id)).not.toBeNull();
      });
    });
  });
}
