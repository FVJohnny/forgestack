import { Inject } from '@nestjs/common';
import {
  Base_QueryHandler,
  Criteria,
  Filters,
  Filter,
  FilterField,
  FilterOperator,
  FilterValue,
  Operator,
  Order,
  OrderTypes,
  PaginationOffset,
} from '@libs/nestjs-common';
import {
  TASK_REPOSITORY,
  type Task_Repository,
} from '@bc/tasks/domain/aggregates/task/task.repository';
import { ListTasks_Query } from './list-tasks.query';
import type { ListTasks_QueryResponse } from './list-tasks.query-response';

export class ListTasks_QueryHandler extends Base_QueryHandler(
  ListTasks_Query,
)<ListTasks_QueryResponse>() {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: Task_Repository,
  ) {
    super();
  }

  async handle(query: ListTasks_Query): Promise<ListTasks_QueryResponse> {
    const criteria = new Criteria({
      filters: new Filters([
        new Filter(
          new FilterField('userId'),
          new FilterOperator(Operator.EQUAL),
          new FilterValue(query.userId),
        ),
      ]),
      order: Order.fromValues('createdAt', OrderTypes.DESC),
      // A personal todo list is small; cap it rather than paginate. Note the
      // Mongo criteria converter queries limit+1 to detect hasNext, so the cap
      // must stay below the Criteria maximum of 100. Swap in offset/cursor
      // pagination when your lists grow.
      pagination: new PaginationOffset(50, 0, true),
    });

    const result = await this.taskRepository.findByCriteria(criteria);

    return {
      tasks: result.data.map((task) => ({
        id: task.id.toValue(),
        title: task.title.toValue(),
        completed: task.completed,
        createdAt: task.timestamps.createdAt.toValue().toISOString(),
        updatedAt: task.timestamps.updatedAt.toValue().toISOString(),
      })),
      total: result.total ?? result.data.length,
    };
  }

  async authorize(_query: ListTasks_Query) {
    return true;
  }

  async validate(_query: ListTasks_Query) {}
}
