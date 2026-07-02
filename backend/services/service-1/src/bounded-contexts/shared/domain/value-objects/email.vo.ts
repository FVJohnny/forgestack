import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';

let _seq = 0;
export class Email extends StringValueObject {
  constructor(value: string) {
    super(value.toLowerCase());
  }

  validate(): void {
    super.validate();
    // Allow empty emails (used when creating credentials without email initially)
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

  getDomain(): string {
    return this.toValue().split('@')[1];
  }

  getLocalPart(): string {
    return this.toValue().split('@')[0];
  }
}
