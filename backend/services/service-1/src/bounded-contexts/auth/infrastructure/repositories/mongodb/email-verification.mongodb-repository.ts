import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { EmailVerificationDTO } from '@bc/auth/domain/aggregates/email-verification/email-verification.dto';
import { EmailVerification_Repository } from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import { Email, Expiration, Verification } from '@bc/auth/domain/value-objects';
import { Id, type RepositoryContext } from '@libs/nestjs-common';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class EmailVerification_MongodbRepository
  extends Base_MongoRepository<EmailVerification, EmailVerificationDTO>
  implements EmailVerification_Repository
{
  static readonly CollectionName = 'auth_email_verifications';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, EmailVerification_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: EmailVerificationDTO): EmailVerification {
    return EmailVerification.fromValue(dto);
  }

  async findByUserId(userId: Id, context?: RepositoryContext) {
    try {
      const session = this.getTransactionSession(context);
      const document = await this.collection.findOne({ userId: userId.toValue() }, { session });

      if (!document) {
        return null;
      }

      return EmailVerification.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findByUserId', userId.toValue(), error);
    }
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

      return EmailVerification.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findByEmail', email.toValue(), error);
    }
  }

  async findPendingByUserId(userId: Id, context?: RepositoryContext) {
    try {
      const session = this.getTransactionSession(context);
      const document = await this.collection.findOne(
        {
          userId: userId.toValue(),
          expiration: { $gt: Expiration.atHoursFromNow(0).toValue() },
          verification: { $eq: Verification.notVerified().toValue() },
        },
        { session },
      );

      if (!document) {
        return null;
      }

      return EmailVerification.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findPendingByUserId', userId.toValue(), error);
    }
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: {
          unique: true,
          name: 'idx_email_verification_id',
        },
      },
      {
        fields: { userId: 1 },
        options: {
          unique: true,
          name: 'idx_email_verification_user_id',
        },
      },
      {
        fields: { email: 1 },
        options: {
          unique: true,
          name: 'idx_email_verification_email',
          collation: { locale: 'en', strength: 2 }, // Case-insensitive
        },
      },
      {
        fields: { expiration: 1, verification: 1 },
        options: { name: 'idx_email_verification_pending' },
      },
      {
        fields: { expiration: 1 },
        options: { name: 'idx_email_verification_expiration' },
      },
    ];
  }
}
