import { Base_InMemoryRepository } from './base.in-memory-repository';
import { EntityExample } from '../domain/example/example.aggregate';
import type { EntityExampleDTO } from '../domain/example/example.dto';

export class Example_InMemoryRepository extends Base_InMemoryRepository<
  EntityExample,
  EntityExampleDTO
> {
  constructor(shouldFail = false) {
    super(shouldFail);
  }

  protected toEntity(dto: EntityExampleDTO): EntityExample {
    return EntityExample.fromValue(dto);
  }

  async findByValue(value: string): Promise<EntityExample | null> {
    const entity = await this.findAll();
    return entity.find((entity) => entity.value === value) ?? null;
  }
}
