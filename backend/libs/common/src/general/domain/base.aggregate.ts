import { isDeepStrictEqual } from 'node:util';

import { AggregateRoot, type IEvent } from '@nestjs/cqrs';
import { Id } from './value-objects/id.vo';
import { Timestamps } from './value-objects/timestamps.vo';
import { DateVO } from './value-objects/date.vo';

export interface SharedAggregateProps {
  id: Id;
  timestamps: Timestamps;
}
/**
 * Base class for aggregate roots in Domain-Driven Design
 */
export abstract class SharedAggregate extends AggregateRoot<IEvent> {
  id: Id;
  timestamps: Timestamps;

  constructor(id?: Id, timestamps?: Timestamps) {
    super();
    this.id = id || Id.random();
    this.timestamps = timestamps || Timestamps.create();
  }

  protected touch(): void {
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  /**
   * Convert the aggregate to its primitive representation
   * This is used for persistence and serialization
   */
  public toValue(): SharedAggregateDTO {
    return {
      id: this.id.toValue(),
      createdAt: this.timestamps.createdAt.toValue(),
      updatedAt: this.timestamps.updatedAt.toValue(),
    };
  }

  /**
   * Compares two aggregate roots for equality based on their primitive values
   * Uses Node's built-in deep equality check
   */
  equals(other?: SharedAggregate | null): boolean {
    return isDeepStrictEqual(this.toValue(), other?.toValue());
  }
}

export class SharedAggregateDTO implements Record<string, unknown> {
  [key: string]: unknown;
  id: string;
  createdAt: Date;
  updatedAt: Date;

  static random(): SharedAggregateDTO {
    return {
      id: Id.random().toValue(),
      createdAt: Timestamps.random().createdAt.toValue(),
      updatedAt: Timestamps.random().updatedAt.toValue(),
    };
  }
}
