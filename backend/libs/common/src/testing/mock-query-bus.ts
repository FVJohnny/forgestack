import type { IQuery, IQueryBus } from '@nestjs/cqrs';

import { ApplicationException } from '../errors';

export interface MockQueryBusOptions {
  shouldFail?: boolean;
}

/**
 * Lightweight QueryBus test double that only records executed queries.
 */
export class MockQueryBus implements IQueryBus {
  public readonly queries: IQuery[] = [];
  public shouldFail: boolean;

  constructor(options: MockQueryBusOptions = {}) {
    this.shouldFail = options.shouldFail ?? false;
  }

  async execute<T extends IQuery = IQuery>(query: T) {
    if (this.shouldFail) {
      throw new ApplicationException('QueryBus execute failed');
    }

    this.queries.push(query);
  }
}
