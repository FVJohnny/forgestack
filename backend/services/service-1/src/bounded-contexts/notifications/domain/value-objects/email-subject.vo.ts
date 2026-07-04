import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';

export class EmailSubject extends StringValueObject {
  private static readonly MAX_LENGTH = 100;
  private static readonly MIN_LENGTH = 1;

  constructor(value: string) {
    super(value.trim());
  }

  validate(): void {
    super.validate();

    if (this.value.length < EmailSubject.MIN_LENGTH) {
      throw new DomainValidationException(
        'emailSubject',
        this.value,
        'Email subject cannot be empty',
      );
    }

    if (this.value.length > EmailSubject.MAX_LENGTH) {
      throw new DomainValidationException(
        'emailSubject',
        this.value,
        `Email subject too long (max ${EmailSubject.MAX_LENGTH} characters, got ${this.value.length})`,
      );
    }
  }
}
