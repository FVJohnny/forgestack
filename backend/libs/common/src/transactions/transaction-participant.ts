export interface TransactionParticipant {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  dispose(): Promise<void>;
}
