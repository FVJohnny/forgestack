import { StringValueObject } from '../../../general';
import { DomainValidationException } from '../../../errors';

export class InboxEventName extends StringValueObject {
  validate(): void {
    super.validate();
    if (!this.value || this.value.trim().length === 0) {
      throw new DomainValidationException(
        'InboxEventName',
        this.value,
        'InboxEventName cannot be empty',
      );
    }
  }

  static random(): InboxEventName {
    const eventNames = ['UserCreated', 'OrderProcessed', 'PaymentCompleted', 'ProductUpdated'];
    const randomName = eventNames[Math.floor(Math.random() * eventNames.length)];
    return new InboxEventName(`${randomName}_IntegrationEvent`);
  }
}
