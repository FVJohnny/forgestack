import type { IQuery } from '@nestjs/cqrs';
import { Base_Query } from '@libs/nestjs-common';

export class SearchUsers_Query extends Base_Query implements IQuery {
  public readonly email: string;
  public readonly limit: number;

  constructor(props: SearchUsers_Query) {
    super();
    Object.assign(this, props);
  }
}
