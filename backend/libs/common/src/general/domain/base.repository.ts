import type { Id } from './value-objects/id.vo';
import type { RepositoryContext } from '../../transactions';
import type { PaginatedRepoResult } from '../infrastructure';
import type { Criteria } from './criteria/criteria';

/**
 * Base repository interface for domain entities.
 * Provides common CRUD operations that can be extended by specific repositories.
 */
export interface Repository<T, ID = Id> {
  /**
   * Finds an entity by its ID
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Finds entities by criteria
   */
  findByCriteria(criteria: Criteria): Promise<PaginatedRepoResult<T>>;

  /**
   * Counts entities by criteria
   */
  countByCriteria(criteria: Criteria): Promise<number>;

  /**
   * Checks if an entity exists by its ID
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Removes an entity by its ID
   */
  remove(id: ID, context?: RepositoryContext): Promise<void>;

  /**
   * Saves an entity (create or update)
   */
  save(entity: T, context?: RepositoryContext): Promise<void>;

  /**
   * Clears the repository
   */
  clear(context?: RepositoryContext): Promise<void>;
}
