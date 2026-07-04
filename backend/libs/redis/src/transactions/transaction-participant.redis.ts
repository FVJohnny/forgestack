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
    const results = await this.pipeline.exec();
    // ioredis returns [[err, res], ...] per queued command. exec() itself does
    // not reject on a per-command error, so surface the first one instead of
    // silently committing a partial pipeline.
    if (results) {
      for (const [err] of results) {
        if (err) {
          throw err;
        }
      }
    }
  }
  async rollback() {
    this.pipeline.discard();
  }
  async dispose() {
    // Intentionally a no-op. The MULTI pipeline holds no resources of its own,
    // and the Redis connection is SHARED (owned by RedisService) — calling
    // quit() here would close the connection for every other repository.
  }
}
