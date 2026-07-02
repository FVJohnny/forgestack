import type { Repository, Id } from '@libs/nestjs-common';
import type { UserIdentityMarker } from './user-identity-marker.aggregate';

export const USER_IDENTITY_MARKER_REPOSITORY = Symbol('UserIdentityMarkerRepository');

export interface UserIdentityMarker_Repository extends Repository<UserIdentityMarker, Id> {
  /**
   * Find the identity marker document for a user
   */
  findByUserId(userId: Id): Promise<UserIdentityMarker | null>;

  /**
   * Find all user IDs that share a specific IP address
   */
  findUserIdsByIp(ip: string): Promise<string[]>;

  /**
   * Find all user IDs that share a specific fingerprint
   */
  findUserIdsByFingerprint(fingerprint: string): Promise<string[]>;
}
