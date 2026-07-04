import type { IEvent } from '@nestjs/cqrs';

import { Id } from '../general/domain/value-objects/id.vo';

/**
 * Base class for all domain events in the system.
 * Provides common properties and behavior for domain events.
 */
export abstract class Base_DomainEvent implements IEvent {
  public readonly occurredOn: Date;
  public readonly id: string;

  constructor(public readonly aggregateId: Id) {
    this.occurredOn = new Date();
    this.id = Id.random().toValue();
  }

  /**
   * Gets the name of the event class
   */
  get name(): string {
    return this.constructor.name;
  }
}
