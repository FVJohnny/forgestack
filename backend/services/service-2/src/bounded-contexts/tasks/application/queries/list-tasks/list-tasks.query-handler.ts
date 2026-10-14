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

/** How many tasks the list returns (newest first). */
export const LIST_TASKS_LIMIT = 50;

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
    const ownedByRequester = new Filter(
      new FilterField('userId'),
      new FilterOperator(Operator.EQUAL),
      new FilterValue(query.userId),
    );

    const criteria = new Criteria({
      filters: new Filters([ownedByRequester]),
      order: Order.fromValues('createdAt', OrderTypes.DESC),
      // A personal todo list is small; cap it rather than paginate. Note the
      // Mongo criteria converter queries limit+1 to detect hasNext, so the cap
      // must stay below the Criteria maximum of 100. Swap in offset/cursor
      // pagination when your lists grow. `total` and `open` below are counted
      // over ALL of the user's tasks, so they stay correct past the cap.
      pagination: new PaginationOffset(LIST_TASKS_LIMIT, 0, true),
    });

    // Counted separately so the UI's "open" figure is not derived from the
    // truncated page.
    const openCriteria = new Criteria({
      filters: new Filters([
        ownedByRequester,
        new Filter(
          new FilterField('completed'),
          new FilterOperator(Operator.EQUAL),
          new FilterValue(false),
        ),
      ]),
    });

    const [result, open] = await Promise.all([
      this.taskRepository.findByCriteria(criteria),
      this.taskRepository.countByCriteria(openCriteria),
    ]);

    return {
      tasks: result.data.map((task) => ({
        id: task.id.toValue(),
        title: task.title.toValue(),
        completed: task.completed,
        createdAt: task.timestamps.createdAt.toValue().toISOString(),
        updatedAt: task.timestamps.updatedAt.toValue().toISOString(),
      })),
      total: result.total ?? result.data.length,
      open,
      limit: LIST_TASKS_LIMIT,
    };
  }

  async authorize(_query: ListTasks_Query) {
    return true;
  }

  async validate(_query: ListTasks_Query) {}
}
