import type { MongoClient, ClientSession } from 'mongodb';
import type { TransactionParticipant } from '@libs/nestjs-common';

export class TransactionParticipant_Mongodb implements TransactionParticipant {
  private readonly session: ClientSession;
  private transactionState: 'active' | 'committed' | 'aborted' = 'active';

  constructor(mongoClient: MongoClient) {
    this.session = mongoClient.startSession();
    this.session.startTransaction();
  }

  getSession(): ClientSession {
    return this.session;
  }

  async commit() {
    if (this.transactionState === 'active') {
      await this.session.commitTransaction();
      this.transactionState = 'committed';
    }
  }

  async rollback() {
    if (this.transactionState === 'active' && this.session.inTransaction()) {
      await this.session.abortTransaction();
      this.transactionState = 'aborted';
    }
  }

  async dispose() {
    await this.session.endSession();
  }
}
