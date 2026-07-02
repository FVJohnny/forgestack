import type { ChainableCommander } from 'ioredis';
import type { TransactionParticipant } from '@libs/nestjs-common';
import type { Redis } from 'ioredis';

/**
 * Redis-specific transaction context that exposes the underlying multi pipeline.
 */
export class TransactionParticipant_Redis implements TransactionParticipant {
  private readonly pipeline: ChainableCommander;

  constructor(public readonly redis: Redis) {
    this.pipeline = redis.multi();
  }

  getPipeline(): ChainableCommander {
    return this.pipeline;
  }

  async commit() {
    await this.pipeline.exec();
  }
  async rollback() {
    await this.pipeline.discard();
  }
  async dispose() {
    await this.pipeline.quit();
  }
}
