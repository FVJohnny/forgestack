import { v4 as uuid, validate as validateUuid } from 'uuid';

import { DomainValidationException } from '../../../errors';
import { StringValueObject } from './string.vo';

export class Id extends StringValueObject {
  // No constructor override needed: the base ValueObject constructor already
  // calls validate() (dispatched to the override below), so it runs exactly
  // once. The previous explicit this.validate() here ran it a second time.

  static random(): Id {
    return new Id(uuid());
  }

  validate(): void {
    if (!validateUuid(this.value)) {
      throw new DomainValidationException(
        `${this.constructor.name}`,
        this.value,
        `${this.constructor.name} does not allow the value ${this.value}`,
      );
    }
  }
}
