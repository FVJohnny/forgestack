import type { PaginatedRepoResult, Repository } from '@libs/nestjs-common';
import type { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import type { Email } from '@bc/auth/domain/value-objects';
import type { Criteria } from '@libs/nestjs-common';
import type { Id } from '@libs/nestjs-common';

export const USER_REPOSITORY = Symbol('UserRepository');
export interface User_Repository extends Repository<User, Id> {
  findByEmail(email: Email): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  existsByEmail(email: Email): Promise<boolean>;
  findAll(): Promise<User[]>;
  findByCriteria(criteria: Criteria): Promise<PaginatedRepoResult<User>>;
  countByCriteria(criteria: Criteria): Promise<number>;
  searchByEmail(emailPattern: string, limit: number): Promise<User[]>;
}
