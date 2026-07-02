import type { IQuery } from '@nestjs/cqrs';
import { Base_Query } from '@libs/nestjs-common';

export class GetMotd_Query extends Base_Query implements IQuery {
  constructor() {
    super();
  }
}
