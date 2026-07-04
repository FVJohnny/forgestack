import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { UserIdentityMarker } from '@bc/auth/domain/aggregates/user-identity-marker/user-identity-marker.aggregate';
import { UserIdentityMarker_Repository } from '@bc/auth/domain/aggregates/user-identity-marker/user-identity-marker.repository';
import { UserIdentityMarkerDTO } from '@bc/auth/domain/aggregates/user-identity-marker/user-identity-marker.dto';
import { Id, type RepositoryContext } from '@libs/nestjs-common';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class UserIdentityMarker_MongodbRepository
  extends Base_MongoRepository<UserIdentityMarker, UserIdentityMarkerDTO>
  implements UserIdentityMarker_Repository
{
  static readonly CollectionName = 'auth_user_identity_markers';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, UserIdentityMarker_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: UserIdentityMarkerDTO): UserIdentityMarker {
    return UserIdentityMarker.fromValue(dto);
  }

  async findByUserId(userId: Id, context?: RepositoryContext): Promise<UserIdentityMarker | null> {
    try {
      const session = this.getTransactionSession(context);
      const document = await this.collection.findOne({ userId: userId.toValue() }, { session });

      if (!document) {
        return null;
      }

      return UserIdentityMarker.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findByUserId', userId.toValue(), error);
    }
  }

  async findUserIdsByIp(ip: string, context?: RepositoryContext): Promise<string[]> {
    try {
      const session = this.getTransactionSession(context);
      const documents = await this.collection
        .find({ 'ips.value': ip }, { session, projection: { userId: 1 } })
        .toArray();

      return documents.map((doc) => doc.userId);
    } catch (error: unknown) {
      this.handleDatabaseError('findUserIdsByIp', ip, error);
    }
  }

  async findUserIdsByFingerprint(
    fingerprint: string,
    context?: RepositoryContext,
  ): Promise<string[]> {
    try {
      const session = this.getTransactionSession(context);
      const documents = await this.collection
        .find({ 'fingerprints.value': fingerprint }, { session, projection: { userId: 1 } })
        .toArray();

      return documents.map((doc) => doc.userId);
    } catch (error: unknown) {
      this.handleDatabaseError('findUserIdsByFingerprint', fingerprint, error);
    }
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: {
          unique: true,
          name: 'idx_identity_marker_id',
        },
      },
      {
        fields: { userId: 1 },
        options: {
          unique: true,
          name: 'idx_identity_marker_user_id',
        },
      },
      {
        fields: { 'ips.value': 1 },
        options: {
          name: 'idx_identity_marker_ips',
          sparse: true,
        },
      },
      {
        fields: { 'fingerprints.value': 1 },
        options: {
          name: 'idx_identity_marker_fingerprints',
          sparse: true,
        },
      },
      {
        fields: { 'deviceIds.value': 1 },
        options: {
          name: 'idx_identity_marker_device_ids',
          sparse: true,
        },
      },
    ];
  }
}
