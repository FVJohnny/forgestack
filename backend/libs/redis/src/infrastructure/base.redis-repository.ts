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
    this.registerTransactionParticipant(context);
    const client = this.getClient(context);

    const keys = await this.getRedisClient().keys('*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
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
