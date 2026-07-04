import { DateVO } from '@libs/nestjs-common';

export class Verification extends DateVO {
  constructor(value: Date) {
    super(value);
  }

  static notVerified(): Verification {
    return new Verification(new Date(0));
  }

  static verified(): Verification {
    return new Verification(new Date());
  }

  isVerified(): boolean {
    return this.toValue().getTime() > 0;
  }
}
