import type { IQuery } from '@nestjs/cqrs';
import { Base_Query } from '@libs/nestjs-common';

export class GetPasswordResetByEmail_Query extends Base_Query implements IQuery {
  public readonly email: string;

  constructor(props: GetPasswordResetByEmail_Query) {
    super();
    Object.assign(this, props);
  }
}
