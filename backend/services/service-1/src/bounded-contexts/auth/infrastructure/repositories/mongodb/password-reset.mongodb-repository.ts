import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import { PasswordResetDTO } from '@bc/auth/domain/aggregates/password-reset/password-reset.dto';
import { PasswordReset_Repository } from '@bc/auth/domain/aggregates/password-reset/password-reset.repository';
import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import {
  Criteria,
  Filters,
  Filter,
  FilterField,
  FilterOperator,
  FilterValue,
  Operator,
} from '@libs/nestjs-common';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class PasswordReset_MongodbRepository
  extends Base_MongoRepository<PasswordReset, PasswordResetDTO>
  implements PasswordReset_Repository
{
  static readonly CollectionName = 'auth_password_resets';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, PasswordReset_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: PasswordResetDTO): PasswordReset {
    return PasswordReset.fromValue(dto);
  }

  async findByEmail(email: Email) {
    const criteria = new Criteria({
      filters: new Filters([
        new Filter(
          new FilterField('email'),
          new FilterOperator(Operator.EQUAL),
          new FilterValue(email.toValue()),
        ),
      ]),
    });

    const result = await this.findByCriteria(criteria);
    return result.data[0] || null;
  }

  async findValidByEmail(email: Email) {
    const criteria = new Criteria({
      filters: new Filters([
        new Filter(
          new FilterField('email'),
          new FilterOperator(Operator.EQUAL),
          new FilterValue(email.toValue()),
        ),
        new Filter(
          new FilterField('expiration'),
          new FilterOperator(Operator.GT),
          new FilterValue(Expiration.atHoursFromNow(0).toValue().toISOString()),
        ),
        new Filter(
          new FilterField('used'),
          new FilterOperator(Operator.EQUAL),
          new FilterValue(Used.no().toValue()),
        ),
      ]),
    });

    const result = await this.findByCriteria(criteria);
    return result.data[0] || null;
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: {
          unique: true,
          name: 'idx_password_reset_id',
        },
      },
      {
        fields: { email: 1 },
        options: {
          name: 'idx_password_reset_email',
          collation: { locale: 'en', strength: 2 }, // Case-insensitive
        },
      },
      {
        fields: { expiration: 1, used: 1 },
        options: { name: 'idx_password_reset_valid' },
      },
      {
        fields: { expiration: 1 },
        options: { name: 'idx_password_reset_expiration' },
      },
    ];
  }
}
