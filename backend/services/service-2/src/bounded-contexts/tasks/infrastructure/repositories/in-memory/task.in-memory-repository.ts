import { Injectable } from '@nestjs/common';
import { Base_InMemoryRepository, Id } from '@libs/nestjs-common';
import type { RepositoryContext } from '@libs/nestjs-common';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import type { Task_Repository } from '@bc/tasks/domain/aggregates/task/task.repository';
import type { TaskDTO } from '@bc/tasks/domain/aggregates/task/task.dto';

@Injectable()
export class Task_InMemoryRepository
  extends Base_InMemoryRepository<Task, TaskDTO>
  implements Task_Repository
{
  constructor(shouldFail: boolean = false) {
    super(shouldFail);
  }

  protected toEntity(dto: TaskDTO): Task {
    return Task.fromValue(dto);
  }

  async deleteByUserId(userId: Id, context?: RepositoryContext): Promise<void> {
    this.validate('deleteByUserId');
    const ids = Array.from(this.items.entries())
      .filter(([, dto]) => dto.userId === userId.toValue())
      .map(([id]) => id);
    // remove() handles transaction snapshot registration per call.
    for (const id of ids) {
      await this.remove(new Id(id), context);
    }
  }
}
