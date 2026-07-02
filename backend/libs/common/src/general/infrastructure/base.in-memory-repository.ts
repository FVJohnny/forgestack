import { InfrastructureException } from '../../errors';
import { type RepositoryContext, TransactionParticipant_InMemory } from '../../transactions';
import type { SharedAggregate, Id, SharedAggregateDTO, Criteria } from '../domain';
import type { Repository } from '../domain';
import { InMemoryCriteriaConverter } from './criteria/criteria-converter.in-memory';

export abstract class Base_InMemoryRepository<
  TEnt extends SharedAggregate,
  TDto extends SharedAggregateDTO,
> implements Repository<TEnt, Id>
{
  protected items: Map<string, TDto> = new Map();

  constructor(public shouldFail: boolean = false) {}

  protected abstract toEntity(dto: TDto): TEnt;

  protected toValue(entity: TEnt): TDto {
    return entity.toValue() as TDto;
  }

  async save(entity: TEnt, context?: RepositoryContext) {
    this.registerTransactionParticipant(context);
    this.validate('save');
    this.items.set(entity.id.toValue(), this.toValue(entity));
  }

  async findAll() {
    this.validate('findAll');
    return Array.from(this.items.values()).map((e) => this.toEntity(e));
  }

  async findById(id: Id) {
    this.validate('findById');
    const ent = this.items.get(id.toValue());
    return ent ? this.toEntity(ent) : null;
  }

  async findByCriteria(criteria: Criteria) {
    this.validate('findByCriteria');
    const entities = await this.findAll();
    const converter = new InMemoryCriteriaConverter<TDto>(entities.map((e) => this.toValue(e)));
    const queryResult = await converter.executeQuery(criteria);

    return {
      data: queryResult.data.map((u) => this.toEntity(u)),
      total: criteria.hasWithTotal() ? queryResult.total : null,
      cursor: queryResult.cursor,
      hasNext: queryResult.hasNext,
    };
  }

  async countByCriteria(criteria: Criteria) {
    this.validate('countByCriteria');
    const entities = await this.findAll();
    const converter = new InMemoryCriteriaConverter<TDto>(entities.map((e) => this.toValue(e)));
    const count = await converter.count(criteria);
    return count;
  }

  async exists(id: Id) {
    this.validate('exists');
    return !!(await this.findById(id));
  }

  async remove(id: Id, context?: RepositoryContext) {
    this.registerTransactionParticipant(context);
    this.validate('remove');
    this.items.delete(id.toValue());
  }

  async clear(context?: RepositoryContext) {
    this.registerTransactionParticipant(context);
    this.validate('clear');
    this.items.clear();
  }

  validate(operation: string): void {
    if (this.shouldFail) {
      throw new InfrastructureException(
        operation,
        `Failed to ${operation}`,
        new Error(`Failed to ${operation}`),
      );
    }
  }

  restoreFromSnapshot(snapshot: Map<string, TDto>): void {
    this.items = new Map(snapshot);
  }

  private registerTransactionParticipant(context?: RepositoryContext) {
    if (!context) return;

    let participant = context.transaction.get('inMemory') as TransactionParticipant_InMemory<
      TEnt,
      TDto
    >;
    if (!participant) {
      participant = new TransactionParticipant_InMemory<TEnt, TDto>();
      context.transaction.register('inMemory', participant);
    }
    participant.saveSnapshot(this, new Map(this.items));
  }
}
