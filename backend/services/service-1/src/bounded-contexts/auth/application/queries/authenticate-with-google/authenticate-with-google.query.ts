import type { IQuery } from '@nestjs/cqrs';
import { Base_Query } from '@libs/nestjs-common';

export class AuthenticateWithGoogle_Query extends Base_Query implements IQuery {
  public readonly accessToken: string;

  constructor(props: { accessToken: string }) {
    super();
    Object.assign(this, props);
  }
}
