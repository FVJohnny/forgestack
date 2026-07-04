import type {
  Criteria,
  CriteriaQueryResult,
  PaginationCursor,
  PaginationOffset,
  SharedAggregateDTO,
} from '@libs/nestjs-common';
import { Data, type Filter, Operator } from '@libs/nestjs-common';
import { CriteriaConverter } from '@libs/nestjs-common';
import { type Collection, type ClientSession } from 'mongodb';

/**
 * MongoDB query options interface
 */
interface MongoQueryOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

/**
 * MongoDB filter condition interface
 */
interface MongoFilterCondition extends Record<string, unknown> {
  [field: string]: unknown;
  $or?: MongoFilterCondition[];
  $and?: MongoFilterCondition[];
}

/**
 * MongoDB criteria conversion result
 */
interface MongoCriteriaResult {
  filters: MongoFilterCondition[];
  options: MongoQueryOptions;
}

/**
 * Converts DDD Criteria to MongoDB filter objects
 */
export class MongoCriteriaConverter<D extends SharedAggregateDTO> extends CriteriaConverter<D> {
  constructor(private readonly collection: Collection<D>) {
    super();
  }
  /**
   * Query a MongoDB collection with criteria and return configured cursor
   */
  query(criteria: Criteria, session?: ClientSession) {
    const { filters: filter, options } = this.convert(criteria);
    const mongoFilter = filter.length === 0 ? {} : { $and: filter };

    return this.collection.find(mongoFilter, { ...options, session });
  }

  /**
   * Execute a full query with metadata including cursor and hasNext
   */
  async executeQuery(criteria: Criteria, session?: ClientSession): Promise<CriteriaQueryResult<D>> {
    const query = this.query(criteria.withExtraLimit(), session);
    let documents = (await query.toArray()) as D[];

    // Check if we got more documents than requested
    const hasNext = criteria.hasLimit() && documents.length > criteria.pagination.limit;

    // Trim to actual limit
    if (criteria.pagination.limit > 0) {
      documents = documents.slice(0, criteria.pagination.limit);
    }
    const total = criteria.hasWithTotal() ? await this.count(criteria, session) : null;
    const cursor = this.generateCursor(documents, criteria);

    return {
      data: documents,
      total,
      cursor,
      hasNext,
    };
  }

  /**
   * Count documents in a MongoDB collection with criteria
   */
  async count(criteria: Criteria, session?: ClientSession): Promise<number> {
    const { filters } = this.convert(criteria.withNoPagination());
    const mongoFilter = filters.length === 0 ? {} : { $and: filters };

    return this.collection.countDocuments(mongoFilter, { session });
  }

  /**
   * Convert a Criteria object to MongoDB filter and options
   */
  convert(criteria: Criteria): MongoCriteriaResult {
    const options: MongoQueryOptions = {};
    const filters = this.buildFilters(criteria);

    options.sort = this.buildSortOptions(criteria);
    if (criteria.pagination.limit !== 0) {
      options.limit = criteria.pagination.limit;
    }

    if (criteria.pagination.type === 'offset') {
      options.skip = (criteria.pagination as PaginationOffset).offset;
    }

    if (criteria.pagination.type === 'cursor') {
      options.limit = (criteria.pagination as PaginationCursor).limit;
      const cursorFilter = this.buildCursorFilter(criteria);
      if (cursorFilter) {
        filters.push(cursorFilter);
      }
    }

    return { filters, options };
  }

  private buildFilters(criteria: Criteria): MongoFilterCondition[] {
    if (!criteria.hasFilters()) {
      return [];
    }

    const filters: MongoFilterCondition[] = [];

    criteria.filters.filters.forEach((filterObj: Filter) => {
      const fieldName = filterObj.field.toValue();
      const operator = filterObj.operator.toValue();
      const value = filterObj.value.toValue();

      const condition: MongoFilterCondition = {};

      switch (operator) {
        case Operator.EQUAL: {
          // Match both the raw string and parsed value to handle type mismatches
          // (e.g. "12345" stored as string in DB but parsed as number)
          const parsed = Data.parseFromString(value);
          condition[fieldName] = parsed === value ? value : { $in: [value, parsed] };
          break;
        }
        case Operator.NOT_EQUAL: {
          const parsedNe = Data.parseFromString(value);
          condition[fieldName] = parsedNe === value ? { $ne: value } : { $nin: [value, parsedNe] };
          break;
        }
        case Operator.CONTAINS:
          condition[fieldName] = { $regex: value, $options: 'i' };
          break;
        case Operator.NOT_CONTAINS:
          condition[fieldName] = { $not: { $regex: value, $options: 'i' } };
          break;
        case Operator.GT:
          condition[fieldName] = { $gt: Data.parseFromString(value) };
          break;
        case Operator.LT:
          condition[fieldName] = { $lt: Data.parseFromString(value) };
          break;
        case Operator.IN: {
          const rawValues = Array.isArray(value) ? value : [value];
          const inValues = rawValues.flatMap((v: string) => {
            const parsed = Data.parseFromString(v);
            return parsed === v ? [v] : [v, parsed];
          });
          condition[fieldName] = { $in: inValues };
          break;
        }
      }

      filters.push(condition);
    });

    return filters;
  }

  private buildCursorFilter(criteria: Criteria): MongoFilterCondition | undefined {
    if (criteria.pagination.type !== 'cursor') {
      return undefined;
    }

    const paginationCursor = criteria.pagination as PaginationCursor;

    // Check if cursor exists
    if (!paginationCursor.cursor) {
      return undefined;
    }

    const orderByValue = criteria.order.orderBy?.toValue();
    const decodedCursor = paginationCursor.decodeCursor();

    const comparator = criteria.order.orderType.isAsc() ? '$gt' : '$lt';

    return {
      $or: [
        { [orderByValue]: { [comparator]: Data.parseFromString(decodedCursor.after) } },
        {
          [orderByValue]: Data.parseFromString(decodedCursor.after),
          id: { [comparator]: decodedCursor.tiebreakerId },
        },
      ],
    };
  }

  private buildSortOptions(criteria: Criteria): Record<string, 1 | -1> | undefined {
    if (!criteria.order.hasOrder()) {
      return undefined;
    }

    const sortOrder = criteria.order.orderType.isAsc() ? 1 : -1;
    const sort: Record<string, 1 | -1> = {
      [criteria.order.orderBy.toValue()]: sortOrder,
    };

    // Add id as tiebreaker for cursor pagination
    if (criteria.pagination.type === 'cursor') {
      sort.id = sortOrder;
    }

    return sort;
  }
}
