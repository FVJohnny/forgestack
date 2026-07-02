import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { User_Repository } from '@bc/auth/domain/aggregates/user/user.repository';
import { Email } from '@bc/auth/domain/value-objects';
import { UserDTO } from '@bc/auth/domain/aggregates/user/user.dto';
import { type RepositoryContext } from '@libs/nestjs-common';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class User_MongodbRepository
  extends Base_MongoRepository<User, UserDTO>
  implements User_Repository
{
  static readonly CollectionName = 'auth_users';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, User_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: UserDTO): User {
    return User.fromValue(dto);
  }

  async findByEmail(email: Email, context?: RepositoryContext) {
    try {
      const session = this.getTransactionSession(context);
      const document = await this.collection.findOne(
        {
          email: email.toValue(),
        },
        { session },
      );

      if (!document) {
        return null;
      }

      return User.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findByEmail', email.toValue(), error);
    }
  }

  async existsByEmail(email: Email, context?: RepositoryContext) {
    try {
      const session = this.getTransactionSession(context);
      const count = await this.collection.countDocuments(
        {
          email: email.toValue(),
        },
        { session },
      );
      return count > 0;
    } catch (error: unknown) {
      this.handleDatabaseError('existsByEmail', email.toValue(), error);
    }
  }

  async findByGoogleId(googleId: string, context?: RepositoryContext): Promise<User | null> {
    try {
      const session = this.getTransactionSession(context);
      const document = await this.collection.findOne(
        {
          googleId,
        },
        { session },
      );

      if (!document) {
        return null;
      }

      return User.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findByGoogleId', googleId, error);
    }
  }

  async searchByEmail(
    emailPattern: string,
    limit: number,
    context?: RepositoryContext,
  ): Promise<User[]> {
    try {
      const session = this.getTransactionSession(context);
      // Escape special regex characters for safety
      const escapedPattern = emailPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const documents = await this.collection
        .find(
          {
            email: { $regex: escapedPattern, $options: 'i' },
          },
          { session },
        )
        .limit(limit)
        .toArray();

      return documents.map((doc) => User.fromValue(doc));
    } catch (error: unknown) {
      this.handleDatabaseError('searchByEmail', emailPattern, error);
    }
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: {
          unique: true,
          name: 'idx_user_id',
        },
      },
      {
        fields: { email: 1 },
        options: {
          unique: true,
          name: 'idx_user_email',
          collation: { locale: 'en', strength: 2 }, // Case-insensitive
        },
      },
      {
        fields: { role: 1 },
        options: { name: 'idx_user_role' },
      },
      {
        fields: { googleId: 1 },
        options: {
          unique: true,
          // Use partial filter instead of sparse - only index documents where googleId exists and is not null
          partialFilterExpression: { googleId: { $exists: true, $type: 'string' } },
          name: 'idx_user_google_id_v2',
        },
      },
    ];
  }
}
