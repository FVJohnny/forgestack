import { Pagination, PaginationType } from './pagination';

export class PaginationOffset extends Pagination {
  readonly limit: number;
  readonly offset: number;
  readonly withTotal: boolean;

  constructor(limit: number = 10, offset: number = 0, withTotal: boolean = false) {
    super(PaginationType.Offset);

    this.limit = limit;
    this.offset = offset;
    this.withTotal = withTotal;
  }

  public withExtraLimit(): PaginationOffset {
    const newLimit = this.limit > 0 ? this.limit + 1 : this.limit;
    return new PaginationOffset(newLimit, this.offset, this.withTotal);
  }
}
