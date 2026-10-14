import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';

// Local copy of the email value object. Bounded contexts do not import each
// other's internals (the no-cross-imports rule), and service-2 has no shared
// context, so the tasks context owns the little it needs.
let _seq = 0;
export class Email extends StringValueObject {
  constructor(value: string) {
    super(value.toLowerCase());
  }

  validate(): void {
    super.validate();
    if (this.isEmpty()) {
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.value)) {
      throw new DomainValidationException(
        'email',
        this.value,
        `Invalid email format: ${this.value}`,
      );
    }
  }

  static empty(): Email {
    return new Email('');
  }

  isEmpty(): boolean {
    return this.value === '';
  }

  static random() {
    return new Email(`random-email-${_seq++}@random-domain.com`);
  }
}
