import type { TransactionParticipant } from './transaction-participant';

export class DistributedTransactionContext {
  private readonly participants = new Map<string, TransactionParticipant>();

  private state: 'pending' | 'committed' | 'rolledBack' = 'pending';

  get(key: string): TransactionParticipant | undefined {
    return this.participants.get(key);
  }

  register(key: string, participant: TransactionParticipant) {
    const existing = this.participants.get(key) as TransactionParticipant | undefined;
    if (existing) {
      return existing;
    }

    this.participants.set(key, participant);
    return participant;
  }

  async commit(): Promise<void> {
    if (this.state === 'committed') {
      return;
    }
    if (this.state === 'rolledBack') {
      throw new Error('Cannot commit a transaction that has already been rolled back.');
    }

    for (const participant of this.participants.values()) {
      await participant.commit();
    }

    this.state = 'committed';
  }

  async rollback(): Promise<void> {
    if (this.state === 'rolledBack') {
      return;
    }

    for (const participant of this.participants.values()) {
      await participant.rollback();
    }

    this.state = 'rolledBack';
  }

  async dispose(): Promise<void> {
    for (const participant of this.participants.values()) {
      await participant.dispose();
    }
  }
}
