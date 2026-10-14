import type { Repository, RepositoryContext } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';
import type { Task } from './task.aggregate';

export const TASK_REPOSITORY = Symbol('TaskRepository');

export interface Task_Repository extends Repository<Task, Id> {
  /**
   * Removes every task belonging to the given user. Used by the user.deleted
   * cascade so a deleted account leaves no orphaned tasks behind.
   */
  deleteByUserId(userId: Id, context?: RepositoryContext): Promise<void>;
}
