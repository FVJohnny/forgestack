import { StringValueObject } from '../../../general';
import { DomainValidationException } from '../../../errors';

let eventNameSequence = 0;

export class OutboxEventName extends StringValueObject {
  constructor(value: string) {
    super(value);
  }

  validate(): void {
    super.validate();
    if (!this.value?.trim()) {
      throw new DomainValidationException(
        'OutboxEventName',
        this.value,
        'Event name cannot be empty',
      );
    }
  }

  static random(): OutboxEventName {
    eventNameSequence += 1;
    return new OutboxEventName(`Outbox.Event.${eventNameSequence}`);
  }
}
