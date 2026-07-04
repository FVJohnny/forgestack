import type { IEventBus } from '@nestjs/cqrs';

import { ApplicationException } from '../errors';
import type { Base_DomainEvent } from '../cqrs';

export interface MockEventBusOptions {
  shouldFail?: boolean;
}

/**
 * Lightweight EventBus test double that only records published events.
 */
export class MockEventBus implements IEventBus {
  public readonly events: Base_DomainEvent[] = [];
  public shouldFail: boolean;

  constructor(options: MockEventBusOptions = {}) {
    this.shouldFail = options.shouldFail ?? false;
  }

  async publish<T extends Base_DomainEvent>(event: T): Promise<void> {
    if (this.shouldFail) {
      throw new ApplicationException('EventBus publish failed');
    }

    this.events.push(event);
  }

  async publishAll<T extends Base_DomainEvent>(events: T[]): Promise<void> {
    if (this.shouldFail) {
      throw new ApplicationException('EventBus publishAll failed');
    }

    this.events.push(...events);
  }
}
