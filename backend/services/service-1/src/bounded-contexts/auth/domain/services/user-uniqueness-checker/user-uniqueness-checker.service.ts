import { Inject, Injectable } from '@nestjs/common';
import type { IUserUniquenessChecker } from './user-uniqueness-checker.interface';
import type { Email } from '@bc/auth/domain/value-objects';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';

/**
 * Domain service implementation for checking user uniqueness constraints.
 *
 * This is a Domain Service because:
 * - It encapsulates domain logic (uniqueness business rule)
 * - It operates on domain concepts (Email, User)
 * - It uses a domain port (User_Repository interface), not infrastructure details
 * - It's part of the ubiquitous language of the domain
 *
 * Domain services can depend on repository ports because ports are part of the domain's
 * boundary. The implementation remains pure domain logic - it doesn't know about
 * MongoDB, Redis, or any other infrastructure concern.
 */
@Injectable()
export class UserUniquenessChecker implements IUserUniquenessChecker {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {}

  async isEmailUnique(email: Email): Promise<boolean> {
    const exists = await this.userRepository.existsByEmail(email);
    return !exists;
  }
}
