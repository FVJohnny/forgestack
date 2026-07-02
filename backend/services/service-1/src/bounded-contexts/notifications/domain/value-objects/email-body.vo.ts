import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';

export class EmailBody extends StringValueObject {
  private static readonly MAX_LENGTH = 100000;
  private static readonly MIN_LENGTH = 1;

  constructor(value: string) {
    super(value.trim());
  }

  validate(): void {
    super.validate();

    if (this.value.length < EmailBody.MIN_LENGTH) {
      throw new DomainValidationException('emailBody', this.value, 'Email body cannot be empty');
    }

    if (this.value.length > EmailBody.MAX_LENGTH) {
      throw new DomainValidationException(
        'emailBody',
        this.value,
        `Email body too long (max ${EmailBody.MAX_LENGTH} characters, got ${this.value.length})`,
      );
    }
  }
}
