import { DateVO } from '../../../general';

export class InboxProcessedAt extends DateVO {
  static readonly NEVER_PROCESSED = new Date('1970-01-01T00:00:00.000Z');

  static now(): InboxProcessedAt {
    return new InboxProcessedAt(new Date());
  }

  static never(): InboxProcessedAt {
    return new InboxProcessedAt(InboxProcessedAt.NEVER_PROCESSED);
  }

  static random(): InboxProcessedAt {
    const randomDate = new Date(Date.now() - Math.random() * 86400000 * 7); // Random date within last 7 days
    return new InboxProcessedAt(randomDate);
  }

  isProcessed(): boolean {
    return this.toValue().getTime() !== InboxProcessedAt.NEVER_PROCESSED.getTime();
  }

  isNeverProcessed(): boolean {
    return this.toValue().getTime() === InboxProcessedAt.NEVER_PROCESSED.getTime();
  }
}
