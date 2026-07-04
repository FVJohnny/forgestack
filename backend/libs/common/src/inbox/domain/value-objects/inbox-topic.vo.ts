import { StringValueObject } from '../../../general';
import { DomainValidationException } from '../../../errors';

export class InboxTopic extends StringValueObject {
  validate(): void {
    super.validate();
    if (!this.value || this.value.trim().length === 0) {
      throw new DomainValidationException('InboxTopic', this.value, 'InboxTopic cannot be empty');
    }
  }

  static random(): InboxTopic {
    const topics = ['users', 'orders', 'payments', 'products'];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    return new InboxTopic(randomTopic);
  }
}
