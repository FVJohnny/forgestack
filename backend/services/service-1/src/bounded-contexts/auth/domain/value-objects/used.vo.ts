import { ValueObject } from '@libs/nestjs-common';

export class Used extends ValueObject<boolean> {
  constructor(value: boolean) {
    super(value);
  }

  static yes(): Used {
    return new Used(true);
  }

  static no(): Used {
    return new Used(false);
  }

  isUsed(): boolean {
    return this.toValue();
  }

  isNotUsed(): boolean {
    return !this.toValue();
  }
}
