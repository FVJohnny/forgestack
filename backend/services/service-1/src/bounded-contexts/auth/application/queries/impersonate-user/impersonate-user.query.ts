import type { IQuery } from '@nestjs/cqrs';
import { Base_Query } from '@libs/nestjs-common';

export class ImpersonateUser_Query extends Base_Query implements IQuery {
  public readonly adminUserId: string;
  public readonly adminEmail: string;
  public readonly targetUserId: string;

  constructor(props: ImpersonateUser_Query) {
    super();
    Object.assign(this, props);
  }
}
