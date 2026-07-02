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
  PaginationOffset,
  Order,
  OrderTypes,
} from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { ListUsers_Query } from './list-users.query';
import type { ListUsers_QueryResponse } from './list-users.query-response';

export class ListUsers_QueryHandler extends Base_QueryHandler(
  ListUsers_Query,
)<ListUsers_QueryResponse>() {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {
    super();
  }

  async handle(query: ListUsers_Query): Promise<ListUsers_QueryResponse> {
    const offset = (query.page - 1) * query.limit;

    // Build criteria with optional filter
    let filters: Filters;
    if (query.filterValue) {
      let filterFieldName: string;

      switch (query.filterField) {
        case 'email':
          filterFieldName = 'email';
          break;
        case 'ip':
          filterFieldName = 'ips.value';
          break;
        default:
          filterFieldName = 'email';
      }

      filters = new Filters([
        new Filter(
          new FilterField(filterFieldName),
          new FilterOperator(Operator.CONTAINS),
          new FilterValue(query.filterValue),
        ),
      ]);
    } else {
      filters = new Filters([]);
    }

    const order = Order.fromValues('email', OrderTypes.ASC);
    const pagination = new PaginationOffset(query.limit, offset, true);

    const criteria = new Criteria({
      filters,
      order,
      pagination,
    });

    const result = await this.userRepository.findByCriteria(criteria);
    const total = result.total || 0;

    return {
      users: result.data.map((user) => ({
        id: user.id.toValue(),
        email: user.email.toValue(),
        role: user.role.toValue() as string,
        status: user.status.toValue() as string,
        createdAt: user.timestamps.createdAt.toValue().toISOString(),
        ips: user.ips.map((entry) => entry.value),
        userAgents: user.userAgents.map((entry) => entry.value),
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async authorize(_query: ListUsers_Query) {
    return true;
  }

  async validate(_query: ListUsers_Query) {}
}
