import { Injectable, Inject } from '@nestjs/common';
import { MongoClient, type Filter } from 'mongodb';
import type { Id, RepositoryContext } from '@libs/nestjs-common';
import { Task } from '@bc/tasks/domain/aggregates/task/task.aggregate';
import { Task_Repository } from '@bc/tasks/domain/aggregates/task/task.repository';
import { TaskDTO } from '@bc/tasks/domain/aggregates/task/task.dto';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class Task_MongodbRepository
  extends Base_MongoRepository<Task, TaskDTO>
  implements Task_Repository
{
  static readonly CollectionName = 'tasks_tasks';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, Task_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: TaskDTO): Task {
    return Task.fromValue(dto);
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: { unique: true, name: 'ux_aggregate_id' },
      },
      {
        // Every read and the user.deleted cascade filter by owner.
        fields: { userId: 1 },
        options: { name: 'ix_user_id' },
      },
    ];
  }

  async deleteByUserId(userId: Id, context?: RepositoryContext): Promise<void> {
    this.registerTransactionParticipant(context);
    try {
      await this.ensureIndexes();
      await this.collection.deleteMany({ userId: userId.toValue() } as Filter<TaskDTO>, {
        session: this.getTransactionSession(context),
      });
    } catch (error: unknown) {
      this.handleDatabaseError('deleteByUserId', userId.toValue(), error);
    }
  }
}
