import { v4 as uuid, validate as validateUuid } from 'uuid';

import { DomainValidationException } from '../../../errors';
import { StringValueObject } from './string.vo';

export class Id extends StringValueObject {
  constructor(value: string) {
    super(value);
    this.validate();
  }

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
