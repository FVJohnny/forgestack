import { Injectable } from '@nestjs/common';
import { PasswordReset } from '@bc/auth/domain/aggregates/password-reset/password-reset.aggregate';
import { PasswordResetDTO } from '@bc/auth/domain/aggregates/password-reset/password-reset.dto';
import { PasswordReset_Repository } from '@bc/auth/domain/aggregates/password-reset/password-reset.repository';
import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import {
  Base_InMemoryRepository,
  Criteria,
  Filters,
  Filter,
  FilterField,
  FilterOperator,
  FilterValue,
  Operator,
} from '@libs/nestjs-common';

@Injectable()
export class PasswordReset_InMemoryRepository
  extends Base_InMemoryRepository<PasswordReset, PasswordResetDTO>
  implements PasswordReset_Repository
{
  constructor(shouldFail: boolean = false) {
    super(shouldFail);
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
}
