import { Filters } from './filters/filters';
import { Order } from './order/order';
import { PaginationOffset } from './pagination/pagination-offset';
import { PaginationCursor } from './pagination/pagination-cursor';
import { ApplicationException, DomainValidationException } from '../../../errors';

interface CriteriaProps {
  filters?: Filters;
  order?: Order;
  pagination?: PaginationOffset | PaginationCursor;
}
export class Criteria implements CriteriaProps {
  readonly filters: Filters;
  readonly order: Order;
  readonly pagination: PaginationOffset | PaginationCursor;

  private static readonly MAX_LIMIT = 100;

  constructor(props: CriteriaProps = {}) {
    this.filters = props.filters || Filters.none();
    this.order = props.order || Order.none();
    this.pagination = props.pagination || new PaginationOffset();
    this.validate();
  }

  public hasFilters(): boolean {
    return this.filters.filters.length > 0;
  }

  public hasWithTotal(): boolean {
    return this.pagination instanceof PaginationOffset && this.pagination.withTotal;
  }

  public withNoPagination(): Criteria {
    return new Criteria({
      filters: this.filters,
      order: this.order,
    });
  }

  public withExtraLimit(): Criteria {
    return new Criteria({
      filters: this.filters,
      order: this.order,
      pagination: this.pagination.withExtraLimit(),
    });
  }

  public hasLimit(): boolean {
    return this.pagination.limit > 0;
  }

  private validate(): void {
    if (this.pagination instanceof PaginationCursor) {
      if (!this.order.hasOrder()) {
        throw new ApplicationException('Cursor pagination requires an order value');
      }
    }

    if (this.pagination.limit > Criteria.MAX_LIMIT) {
      throw new DomainValidationException(
        'Criteria limit',
        this.pagination.limit,
        'exceeds maximum limit of ' + Criteria.MAX_LIMIT,
      );
    }
  }
}
