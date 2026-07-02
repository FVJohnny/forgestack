import { StringValueObject } from '../../value-objects/string.vo';

export class FilterValue extends StringValueObject {
  constructor(value: unknown) {
    super(String(value));
  }
}
