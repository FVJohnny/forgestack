import { Inject } from '@nestjs/common';
import {
  MongoClient,
  Collection,
  CreateIndexesOptions,
  IndexSpecification,
  MongoServerError,
  Filter,
} from 'mongodb';
import type { ClientSession } from 'mongodb';
import {
  CorrelationLogger,
  SharedAggregateDTO,
  AlreadyExistsException,
  InfrastructureException,
  SharedAggregate,
  Id,
  Criteria,
  PaginatedRepoResult,
} from '@libs/nestjs-common';
import type { RepositoryContext, Repository } from '@libs/nestjs-common';
import { TransactionParticipant_Mongodb } from '../transactions/transaction-participant.mongodb';
import { MongoCriteriaConverter } from '../criteria/criteria-converter.mongo';
import { MONGO_CLIENT_TOKEN } from '../mongodb.module';

export interface IndexSpec {
  fields: IndexSpecification;
  options?: CreateIndexesOptions;
}

export abstract class Base_MongoRepository<
  TEnt extends SharedAggregate,
  TDto extends SharedAggregateDTO & { id: string },
> implements Repository<TEnt, Id>
{
  protected readonly logger: CorrelationLogger;
  protected readonly collection: Collection<TDto>;
  private indexesInitialized: Promise<void>;
  private static indexInitializationLocks: Map<string, Promise<void>> = new Map();

  constructor(
    @Inject(MONGO_CLIENT_TOKEN)
    protected readonly mongoClient: MongoClient,
    private readonly collectionName: string,
  ) {
    this.logger = new CorrelationLogger(this.constructor.name);
    this.collection = this.mongoClient.db().collection<TDto>(this.collectionName);

    let existingLock = Base_MongoRepository.indexInitializationLocks.get(this.collectionName);
    if (!existingLock) {
      existingLock = this.initializeIndexes();
      Base_MongoRepository.indexInitializationLocks.set(this.collectionName, existingLock);
    }
    this.indexesInitialized = existingLock;
  }

  async ensureIndexes(): Promise<void> {
    await this.indexesInitialized;
  }

  protected abstract toEntity(dto: TDto): TEnt;

  protected toValue(entity: TEnt): TDto {
    return entity.toValue() as TDto;
  }

  async save(entity: TEnt, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);

    const session = this.getTransactionSession(context);
    try {
      await this.ensureIndexes();
      await this.collection.updateOne(
        { id: entity.id.toValue() } as Filter<TDto>,
        { $set: this.toValue(entity) },
        { upsert: true, session },
      );
    } catch (error: unknown) {
      this.handleDatabaseError('save', entity.id.toValue(), error);
    }
  }

  async findById(id: Id): Promise<TEnt | null> {
    try {
      const dto = await this.collection.findOne({ id: id.toValue() } as Filter<TDto>);
      return dto ? this.toEntity(dto as TDto) : null;
    } catch (error: unknown) {
      this.handleDatabaseError('findById', id.toValue(), error);
    }
  }

  async exists(id: Id): Promise<boolean> {
    try {
      const dto = await this.collection.findOne({ id: id.toValue() } as Filter<TDto>);
      return !!dto;
    } catch (error: unknown) {
      this.handleDatabaseError('exists', id.toValue(), error);
    }
  }

  async remove(id: Id, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);

    const session = this.getTransactionSession(context);
    try {
      await this.collection.deleteOne({ id: id.toValue() } as Filter<TDto>, { session });
    } catch (error: unknown) {
      this.handleDatabaseError('remove', id.toValue(), error);
    }
  }

  async clear(context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);

    const session = this.getTransactionSession(context);
    try {
      await this.collection.deleteMany({}, { session });
    } catch (error: unknown) {
      this.handleDatabaseError('clear', '', error);
    }
  }

  async findAll(): Promise<TEnt[]> {
    try {
      const docs = await this.collection.find({}).toArray();
      return docs.map((dto) => this.toEntity(dto as TDto));
    } catch (error: unknown) {
      this.handleDatabaseError('findAll', '', error);
    }
  }

  async findByCriteria(criteria: Criteria): Promise<PaginatedRepoResult<TEnt>> {
    await this.ensureIndexes();
    try {
      const converter = new MongoCriteriaConverter<TDto>(this.collection);
      const { data, total, cursor, hasNext } = await converter.executeQuery(criteria);

      return {
        data: data.map((doc) => this.toEntity(doc)),
        total,
        cursor,
        hasNext,
      };
    } catch (error: unknown) {
      this.handleDatabaseError('findByCriteria', '', error);
    }
  }

  async countByCriteria(criteria: Criteria, context?: RepositoryContext): Promise<number> {
    try {
      const session = this.getTransactionSession(context);
      const converter = new MongoCriteriaConverter<TDto>(this.collection);
      return await converter.count(criteria, session);
    } catch (error: unknown) {
      this.handleDatabaseError('countByCriteria', 'criteria', error);
    }
  }

  protected abstract defineIndexes(): IndexSpec[];

  private async initializeIndexes() {
    try {
      const collections = await this.mongoClient
        .db()
        .listCollections({ name: this.collectionName })
        .toArray();

      if (collections.length === 0) {
        await this.mongoClient.db().createCollection(this.collectionName);
        this.logger.debug(`${this.collectionName} collection created and initializing indexes`);
      }

      // Check if indexes already exist to avoid recreation
      const existingIndexes = await this.collection.indexes();
      const indexNames = existingIndexes.map((idx) => idx.name);

      const userIndexSpecs = this.defineIndexes();
      const hasIdIndex =
        userIndexSpecs.some((spec) => (spec.fields as Record<string, unknown>)?.id === 1) ||
        existingIndexes.some(
          (idx) =>
            idx.key &&
            (idx.key as Record<string, unknown>).id === 1 &&
            Object.keys(idx.key).length === 1,
        );

      const indexSpecs: IndexSpec[] = hasIdIndex
        ? userIndexSpecs
        : [
            { fields: { id: 1 }, options: { unique: true, name: 'ux_aggregate_id' } },
            ...userIndexSpecs,
          ];

      for (const indexSpec of indexSpecs) {
        const indexName = indexSpec.options?.name;
        if (!indexName) {
          this.logger.warn(`Index definition missing name, skipping: ${indexSpec.fields}`);
          continue;
        }

        if (!indexNames.includes(indexName)) {
          await this.collection.createIndex(indexSpec.fields, indexSpec.options);
          this.logger.debug(`Created index: ${indexName}`);
        }
      }

      this.logger.debug(`${this.collectionName} collection indexes initialized successfully`);
    } catch (error) {
      this.logger.error(
        `Error initializing ${this.collectionName} collection indexes:`,
        error instanceof Error ? error : String(error),
      );
    }
  }

  protected handleDatabaseError(operation: string, id: string, error: unknown): never {
    const err = error instanceof Error ? error : new Error(String(error));

    // Handle MongoDB duplicate key errors
    if (error instanceof MongoServerError && error.code === 11000) {
      const keyPattern = error.keyPattern;
      const keyValue = error.keyValue;

      if (keyPattern && keyValue) {
        const duplicateKey = Object.keys(keyPattern)[0];
        const duplicateValue = keyValue[duplicateKey] || 'unknown value';
        throw new AlreadyExistsException(duplicateKey, duplicateValue);
      }
    }

    throw new InfrastructureException(operation, id, err);
  }

  // TRANSACTIONS - registration
  protected registerTransactionParticipant(context?: RepositoryContext): void {
    if (!context) return;

    const participant = context.transaction.get('mongo') as TransactionParticipant_Mongodb;
    if (!participant) {
      context.transaction.register('mongo', new TransactionParticipant_Mongodb(this.mongoClient));
    }
  }

  // TRANSACTIONS - get session
  protected getTransactionSession(context?: RepositoryContext): ClientSession | undefined {
    if (!context) return undefined;

    const participant = context.transaction.get('mongo') as TransactionParticipant_Mongodb;
    return participant?.getSession();
  }
}
