import type { IQuery } from '@nestjs/cqrs';
import { Base_Query } from '@libs/nestjs-common';

export class GetNewTokensFromUserCredentials_Query extends Base_Query implements IQuery {
  public readonly email: string;
  public readonly password: string;

  constructor(props: { email: string; password: string }) {
    super();
    Object.assign(this, props);
  }
}
