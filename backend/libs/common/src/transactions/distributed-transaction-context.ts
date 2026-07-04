import type { TransactionParticipant } from './transaction-participant';

/**
 * Coordinates one transaction per participating store (e.g. Mongo session,
 * Redis MULTI). It is NOT a two-phase commit: participants are committed in
 * sequence, so if store A commits and store B then fails, A is already
 * durable and is not rolled back. In practice each Transaction.run touches a
 * single store, which IS atomic; mixing stores (e.g. Mongo + Redis) in one
 * run is best-effort and should be avoided when true atomicity is required.
 */
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
    // Dispose every participant even if one throws, so a single failing
    // cleanup cannot leak the remaining participants' resources. Surface the
    // first error after all have been attempted.
    let firstError: unknown;
    for (const participant of this.participants.values()) {
      try {
        await participant.dispose();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) {
      throw firstError;
    }
  }
}
