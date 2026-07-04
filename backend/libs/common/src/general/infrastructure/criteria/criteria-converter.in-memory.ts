import { Data } from '../../../utils/data.util';
import type { SharedAggregateDTO } from '../../domain/base.aggregate';
import type { CriteriaQueryResult, Criteria, Filter, Order } from '../../domain/criteria';
import {
  PaginationCursor,
  PaginationOffset,
  Operator,
  CriteriaConverter,
} from '../../domain/criteria';
import { ApplicationException } from '../../../errors';

export interface InMemoryFilterResult<T> {
  filterFn: (items: T[]) => T[];
  sortFn: (a: T, b: T) => number;
  paginationFn: (items: T[]) => {
    data: T[];
    total: number | null;
    hasNext?: boolean;
  };
}

/**
 * Converts DDD Criteria to in-memory filtering, sorting and pagination functions
 * Generic implementation that works with any entity that has toValue() method
 */
export class InMemoryCriteriaConverter<D extends SharedAggregateDTO> extends CriteriaConverter<D> {
  constructor(private readonly allItems: D[]) {
    super();
  }

  /**
   * Query an in-memory array with criteria and return filtered, sorted, and paginated results
   */
  executeQuery(criteria: Criteria): Promise<CriteriaQueryResult<D>> {
    const { filterFn, sortFn, paginationFn } = this.convert(criteria);

    let filteredItems = filterFn(this.allItems);

    filteredItems = filteredItems.sort(sortFn);

    const paginatedResults = paginationFn(filteredItems);

    const cursor = this.generateCursor(paginatedResults.data, criteria);

    return Promise.resolve({
      ...paginatedResults,
      cursor,
    });
  }

  /**
   * Count items in an in-memory array with criteria (without pagination)
   */
  count(criteria: Criteria): Promise<number> {
    const { filterFn } = this.convert(criteria);
    return Promise.resolve(filterFn(this.allItems).length);
  }

  /**
   * Convert a Criteria object to in-memory filter functions
   */
  convert(criteria: Criteria): InMemoryFilterResult<D> {
    const shouldSort = criteria.order.hasOrder();

    return {
      filterFn: (items: D[]) => this.applyFilters(items, criteria),
      sortFn: shouldSort ? (a: D, b: D) => this.applySorting(a, b, criteria.order) : () => 0,
      paginationFn: (items: D[]) => this.applyPagination(items, criteria),
    };
  }

  private applyFilters(items: D[], criteria: Criteria): D[] {
    return items.filter((item) => {
      return criteria.filters.filters.every((filter: Filter) => {
        const userValue = Data.getNestedValue(item, filter.field.toValue());
        return this.matchesFilter(userValue, filter);
      });
    });
  }

  private matchesFilter(value: unknown, filter: Filter): boolean {
    // For string operations (CONTAINS, NOT_CONTAINS), use raw string values
    if (filter.operator.isStringOperator()) {
      const valueStr = String(value);
      const filterStr = String(filter.value.toValue());

      if (filter.operator.is(Operator.CONTAINS)) {
        return valueStr.toLowerCase().includes(filterStr.toLowerCase());
      }

      if (filter.operator.is(Operator.NOT_CONTAINS)) {
        return !valueStr.toLowerCase().includes(filterStr.toLowerCase());
      }
    }

    // For other operations, parse values for proper type comparison.
    // Filter values arrive as strings (FilterValue extends StringValueObject), so they need parsing.
    // Item values come straight from the DTO with their native type (Date, number, boolean, ...) —
    // round-tripping them through String() loses precision (e.g. Date.toString() drops milliseconds),
    // which can make the filter disagree with direct typed comparisons elsewhere in the code.
    const a = value;
    const b = Data.parseFromString(String(filter.value.toValue()));

    if (filter.operator.is(Operator.EQUAL)) {
      return Data.compareValues(a, b) === 0;
    }

    if (filter.operator.is(Operator.NOT_EQUAL)) {
      return Data.compareValues(a, b) !== 0;
    }

    if (filter.operator.is(Operator.GT)) {
      return Data.compareValues(a, b) > 0;
    }

    if (filter.operator.is(Operator.LT)) {
      return Data.compareValues(a, b) < 0;
    }

    throw new ApplicationException(`Unsupported operator: ${filter.operator.toValue()}`);
  }

  private applySorting(a: D, b: D, order: Order): number {
    const orderBy = order.orderBy.toValue();

    const aValue = Data.getNestedValue(a, orderBy);
    const bValue = Data.getNestedValue(b, orderBy);

    const comparison = Data.compareValues(aValue, bValue);
    const dir = order.orderType.isAsc() ? 1 : -1;

    if (comparison !== 0) {
      return dir * comparison;
    }

    // If values are equal, sort by id
    return dir * Data.compareValues(a.id, b.id);
  }

  private applyPagination(items: D[], criteria: Criteria): CriteriaQueryResult<D> {
    let result = items;
    let total: number | null = null;
    let hasNext: boolean | undefined;
    let offset = 0;
    const limit = criteria.pagination.limit;

    if (criteria.pagination instanceof PaginationOffset) {
      offset = criteria.pagination.offset;
      if (criteria.pagination.withTotal) total = items.length;
    }

    if (criteria.pagination instanceof PaginationCursor) {
      result = this.applyCursorPagination(items, criteria);
    }

    if (limit === 0) {
      result = result.slice(offset);
      hasNext = false;
    } else {
      result = result.slice(offset, offset + limit + 1); // +1 peek
      hasNext = result.length > limit;
      result = result.slice(0, limit);
    }

    return { data: result, total, hasNext };
  }

  private applyCursorPagination(items: D[], criteria: Criteria): D[] {
    if (
      !(criteria.pagination instanceof PaginationCursor) ||
      !criteria.order.hasOrder() ||
      !criteria.pagination.cursor
    ) {
      return items;
    }

    const orderBy = criteria.order.orderBy.toValue();
    const isDesc = criteria.order.orderType.isDesc();
    const cursor = criteria.pagination.decodeCursor();

    return items.filter((item) => {
      const itemValue = Data.getNestedValue(item, orderBy);
      const itemId = Data.getNestedValue(item, 'id');

      if (itemValue === undefined || itemValue === null) {
        return false;
      }

      // Convert values to comparable types. The cursor arrives as a serialized string,
      // so it needs parsing. Item values are native types from the DTO — don't re-stringify
      // them (round-tripping a Date drops milliseconds, which breaks tie-breaking).
      const parsedItemValue = itemValue;
      const parsedAfter = Data.parseFromString(String(cursor.after));

      // With tiebreaker: handle ties using ID
      if (isDesc) {
        return (
          Data.compareValues(parsedItemValue, parsedAfter) < 0 ||
          (Data.compareValues(parsedItemValue, parsedAfter) === 0 &&
            String(itemId) < cursor.tiebreakerId)
        );
      } else {
        return (
          Data.compareValues(parsedItemValue, parsedAfter) > 0 ||
          (Data.compareValues(parsedItemValue, parsedAfter) === 0 &&
            String(itemId) > cursor.tiebreakerId)
        );
      }
    });
  }
}
