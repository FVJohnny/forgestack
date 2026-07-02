import type { IndexSpec } from '../infrastructure/base.mongo-repository';
import { Base_MongoRepository } from '../infrastructure/base.mongo-repository';
import type { EntityExampleDTO, ExampleRepository } from '@libs/nestjs-common';
import type { MongoClient } from 'mongodb';
import {
  Criteria,
  EntityExample,
  Filter,
  FilterField,
  FilterOperator,
  Filters,
  FilterValue,
} from '@libs/nestjs-common';

export class Example_MongoRepository
  extends Base_MongoRepository<EntityExample, EntityExampleDTO>
  implements ExampleRepository
{
  static CollectionName = 'transaction-test';

  constructor(mongoClient: MongoClient) {
    super(mongoClient, Example_MongoRepository.CollectionName);
  }

  protected toEntity(dto: EntityExampleDTO): EntityExample {
    return EntityExample.fromValue(dto);
  }

  protected defineIndexes(): IndexSpec[] {
    return [];
  }

  async findByValue(value: string): Promise<EntityExample | null> {
    const criteria = new Criteria({
      filters: new Filters([
        new Filter(new FilterField('value'), FilterOperator.equal(), new FilterValue(value)),
      ]),
    });
    const entity = await this.findByCriteria(criteria);
    return entity.data[0] ?? null;
  }
}
