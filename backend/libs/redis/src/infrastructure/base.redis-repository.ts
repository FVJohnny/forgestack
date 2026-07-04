import type { ChainableCommander, Redis } from 'ioredis';
import { CorrelationLogger, ApplicationException } from '@libs/nestjs-common';
import type {
  RepositoryContext,
  Id,
  Repository,
  SharedAggregate,
  Criteria,
  PaginatedRepoResult,
} from '@libs/nestjs-common';

import { TransactionParticipant_Redis } from '../transactions/transaction-participant.redis';
import type { RedisService } from '../redis.service';

export abstract class Base_RedisRepository<TEnt extends SharedAggregate>
  implements Repository<TEnt, Id>
{
  protected readonly logger: CorrelationLogger;

  constructor(private readonly redisService: RedisService) {
    this.logger = new CorrelationLogger(this.constructor.name);
  }

  protected abstract itemKey(id: string): string;
  protected abstract toEntity(json: string): TEnt;

  async findByCriteria(
    _criteria: Criteria,
    _context?: RepositoryContext,
  ): Promise<PaginatedRepoResult<TEnt>> {
    throw new ApplicationException('findByCriteria is not implemented for Redis repositories');
  }

  async countByCriteria(_criteria: Criteria, _context?: RepositoryContext): Promise<number> {
    throw new ApplicationException('countByCriteria is not implemented for Redis repositories');
  }

  async findById(id: Id): Promise<TEnt | null> {
    const client = this.getRedisClient();

    const key = this.itemKey(id.toValue());
    const json = await client.get(key);
    if (!json) return null;

    return this.toEntity(json);
  }

  async exists(id: Id): Promise<boolean> {
    const client = this.getRedisClient();
    const key = this.itemKey(id.toValue());

    const exists = await client.exists(key);
    return exists === 1;
  }

  async save(entity: TEnt, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);
    const client = this.getClient(context);

    const v = entity.toValue();
    const key = this.itemKey(v.id);

    await client.set(key, JSON.stringify(v));
  }

  async remove(id: Id, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);
    const client = this.getClient(context);

    const key = this.itemKey(id.toValue());
    await client.del(key);
  }

  async clear(context?: RepositoryContext): Promise<void> {
    // Only delete this repository's own keys (derived from itemKey), never
    // the whole database: Redis is shared by every repository and by other
    // concerns like sessions and rate limits.
    await this.deleteByPattern(this.itemKey('*'), context);
  }

  /**
   * Deletes all keys matching the pattern using SCAN, which iterates in
   * batches instead of blocking Redis the way KEYS does.
   */
  protected async deleteByPattern(pattern: string, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);
    const client = this.getClient(context);
    const redis = this.getRedisClient();

    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  }

  protected getClient(context?: RepositoryContext): Redis | ChainableCommander {
    return this.getTransactionClient(context) ?? this.redisService.getDatabaseClient()!;
  }

  protected getRedisClient(): Redis {
    return this.redisService.getDatabaseClient()!;
  }

  protected getTransactionClient(context?: RepositoryContext): ChainableCommander | undefined {
    const transaction = context?.transaction;

    if (!transaction) {
      return undefined;
    }

    const participant = transaction.get('redis') as TransactionParticipant_Redis;
    return participant?.getPipeline();
  }

  protected isTransactional(context?: RepositoryContext): boolean {
    return !!this.getTransactionClient(context);
  }

  protected registerTransactionParticipant(context?: RepositoryContext) {
    if (!context) return;

    let participant = context.transaction.get('redis') as TransactionParticipant_Redis;
    if (!participant) {
      participant = new TransactionParticipant_Redis(this.getRedisClient());
      context.transaction.register('redis', participant);
    }
  }
}
