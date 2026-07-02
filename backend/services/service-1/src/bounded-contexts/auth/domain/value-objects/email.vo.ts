import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';
import { isDisposableEmailDomain } from './disposable-email-domains';

let _seq = 0;
export class Email extends StringValueObject {
  constructor(value: string, options?: { skipDisposableCheck?: boolean }) {
    super(value.toLowerCase());

    this.validate(options?.skipDisposableCheck);
  }

  validate(skipDisposableCheck = false): void {
    super.validate();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.value)) {
      throw new DomainValidationException(
        'email',
        this.value,
        `Invalid email format: ${this.value}`,
      );
    }

    // Check for disposable/throwaway email domains
    if (!skipDisposableCheck) {
      const domain = this.getDomain();
      if (isDisposableEmailDomain(domain)) {
        throw new DomainValidationException(
          'email',
          this.value,
          'Disposable email addresses are not allowed. Please use a permanent email address.',
        );
      }
    }
  }

  static random() {
    return new Email(`random-email-${_seq++}@random-domain.com`, { skipDisposableCheck: true });
  }

  getDomain(): string {
    return this.toValue().split('@')[1];
  }

  getLocalPart(): string {
    return this.toValue().split('@')[0];
  }
}
