import type {
  Criteria,
  CriteriaQueryResult,
  PaginationCursor,
  PaginationOffset,
  SharedAggregateDTO,
} from '@libs/nestjs-common';
import { Data, type Filter, Operator, CriteriaConverter } from '@libs/nestjs-common';
import type { Redis } from 'ioredis';

/**
 * Redis scan options interface
 */
interface RedisScanOptions {
  match?: string;
  count?: number;
  type?: string;
}

/**
 * Redis criteria conversion result
 */
interface RedisCriteriaResult {
  scanPattern: string;
  scanOptions: RedisScanOptions;
  filterFunctions: Array<(item: Record<string, unknown>) => boolean>;
}

/**
 * Converts DDD Criteria to Redis scan patterns and filters
 * Works with hash-based Redis storage where entities are stored as hashes
 */
export class RedisCriteriaConverter<D extends SharedAggregateDTO> extends CriteriaConverter<D> {
  constructor(
    private readonly redis: Redis,
    public readonly keyPrefix: string,
  ) {
    super();
  }

  /**
   * Execute a full query with metadata including cursor and hasNext
   */
  async executeQuery(criteria: Criteria): Promise<CriteriaQueryResult<D>> {
    const { scanPattern, scanOptions, filterFunctions } = this.convert(criteria);

    // Scan for matching keys
    const keys = await this.scanKeys(scanPattern, scanOptions);

    // Fetch all matching entities
    let entities: D[] = [];
    if (keys.length > 0) {
      entities = await this.fetchEntities(keys);
    }

    // Apply in-memory filtering for complex conditions
    entities = this.applyFilters(entities, filterFunctions);

    // Apply sorting (always, for consistent ordering)
    entities = this.applySorting(entities, criteria);

    // Apply pagination
    const paginatedResult = this.applyPagination(entities, criteria);

    // Get total count if requested
    const total = criteria.hasWithTotal() ? await this.count(criteria) : null;

    // Generate cursor for cursor-based pagination
    const cursor = this.generateCursor(paginatedResult.data, criteria);

    return {
      data: paginatedResult.data,
      total,
      cursor,
      hasNext: paginatedResult.hasNext,
    };
  }

  /**
   * Count entities in Redis with criteria
   */
  async count(criteria: Criteria): Promise<number> {
    const { scanPattern, scanOptions, filterFunctions } = this.convert(criteria.withNoPagination());

    // Scan for matching keys
    const keys = await this.scanKeys(scanPattern, scanOptions);

    if (filterFunctions.length === 0) {
      return keys.length;
    }

    // Fetch and filter entities if we have complex filters
    const entities = await this.fetchEntities(keys);
    const filtered = this.applyFilters(entities, filterFunctions);

    return filtered.length;
  }

  /**
   * Convert a Criteria object to Redis scan pattern and filter functions
   */
  convert(criteria: Criteria): RedisCriteriaResult {
    const scanPattern = this.buildScanPattern(criteria);
    const scanOptions = this.buildScanOptions(criteria);
    const filterFunctions = this.buildFilterFunctions(criteria);

    return {
      scanPattern,
      scanOptions,
      filterFunctions,
    };
  }

  /**
   * Scan Redis for keys matching the pattern
   */
  private async scanKeys(pattern: string, options: RedisScanOptions): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', options.count || 100);

      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Fetch entities from Redis by keys
   */
  private async fetchEntities(keys: string[]): Promise<D[]> {
    if (keys.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();

    // Fetch all hashes
    for (const key of keys) {
      pipeline.hgetall(key);
    }

    const results = await pipeline.exec();

    if (!results) {
      return [];
    }

    return results
      .map(([err, data]) => {
        if (err || !data) return null;
        // Parse the hash data into entity format
        return this.parseEntity(data as Record<string, string>);
      })
      .filter((entity): entity is D => entity !== null);
  }

  /**
   * Parse Redis hash data into entity format
   */
  private parseEntity(hashData: Record<string, string>): D | null {
    try {
      const parsed: Record<string, unknown> = {};

      for (const [field, value] of Object.entries(hashData)) {
        // Handle nested JSON fields
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            parsed[field] = JSON.parse(value);
          } catch {
            parsed[field] = value;
          }
        } else {
          parsed[field] = Data.parseFromString(value);
        }
      }

      return parsed as D;
    } catch {
      return null;
    }
  }

  /**
   * Build Redis scan pattern from criteria
   */
  private buildScanPattern(criteria: Criteria): string {
    // Start with the base key prefix
    let pattern = `${this.keyPrefix}:*`;

    // Try to optimize the pattern based on equality filters
    if (criteria.hasFilters()) {
      const idFilter = criteria.filters.filters.find(
        (f) => f.field.toValue() === 'id' && f.operator.is(Operator.EQUAL),
      );

      if (idFilter) {
        // If we have an exact ID match, use a specific key
        pattern = `${this.keyPrefix}:${idFilter.value.toValue()}`;
      }
    }

    return pattern;
  }

  /**
   * Build Redis scan options
   */
  private buildScanOptions(criteria: Criteria): RedisScanOptions {
    const options: RedisScanOptions = {};

    // Set scan count based on limit
    if (criteria.pagination.limit > 0) {
      // Scan in batches, but don't exceed the limit too much
      options.count = Math.min(criteria.pagination.limit * 2, 1000);
    } else {
      options.count = 100;
    }

    return options;
  }

  /**
   * Build filter functions for in-memory filtering
   */
  private buildFilterFunctions(
    criteria: Criteria,
  ): Array<(item: Record<string, unknown>) => boolean> {
    if (!criteria.hasFilters()) {
      return [];
    }

    return criteria.filters.filters.map((filter: Filter) => {
      const field = filter.field.toValue();
      const operator = filter.operator.toValue();
      const filterValue = filter.value.toValue();

      return (item: Record<string, unknown>) => {
        const itemValue = Data.getNestedValue(item, field);

        switch (operator) {
          case Operator.EQUAL:
            return Data.compareValues(itemValue, Data.parseFromString(filterValue)) === 0;

          case Operator.NOT_EQUAL:
            return Data.compareValues(itemValue, Data.parseFromString(filterValue)) !== 0;

          case Operator.CONTAINS:
            if (itemValue === undefined || itemValue === null) {
              return false;
            }
            return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());

          case Operator.NOT_CONTAINS:
            if (itemValue === undefined || itemValue === null) {
              return true;
            }
            return !String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());

          case Operator.GT:
            return Data.compareValues(itemValue, Data.parseFromString(filterValue)) > 0;

          case Operator.LT:
            return Data.compareValues(itemValue, Data.parseFromString(filterValue)) < 0;

          default:
            return true;
        }
      };
    });
  }

  /**
   * Compare IDs with proper numeric handling for entity IDs like "entity-1", "entity-10"
   */
  private compareIds(a: unknown, b: unknown): number {
    const aStr = String(a);
    const bStr = String(b);

    // Extract numeric part if it follows the pattern "entity-N"
    const aMatch = aStr.match(/^entity-(\d+)$/);
    const bMatch = bStr.match(/^entity-(\d+)$/);

    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1], 10);
      const bNum = parseInt(bMatch[1], 10);
      return aNum - bNum;
    }

    // Fall back to string comparison for non-entity IDs
    return aStr.localeCompare(bStr);
  }

  /**
   * Apply filter functions to entities
   */
  private applyFilters(
    entities: D[],
    filterFunctions: Array<(item: Record<string, unknown>) => boolean>,
  ): D[] {
    if (filterFunctions.length === 0) {
      return entities;
    }

    return entities.filter((entity) => filterFunctions.every((fn) => fn(entity)));
  }

  /**
   * Apply sorting to entities
   */
  private applySorting(entities: D[], criteria: Criteria): D[] {
    // Always sort to ensure consistent ordering, even if no explicit order is specified
    const orderBy = criteria.order.hasOrder() ? criteria.order.orderBy.toValue() : 'id';
    const isAsc = criteria.order.hasOrder() ? criteria.order.orderType.isAsc() : true;

    return [...entities].sort((a, b) => {
      const aValue = Data.getNestedValue(a, orderBy);
      const bValue = Data.getNestedValue(b, orderBy);

      const comparison =
        orderBy === 'id' ? this.compareIds(aValue, bValue) : Data.compareValues(aValue, bValue);

      if (comparison !== 0) {
        return isAsc ? comparison : -comparison;
      }

      // Use ID as tiebreaker only if we're not already sorting by ID
      if (orderBy !== 'id') {
        const idComparison = this.compareIds(a.id, b.id);
        return isAsc ? idComparison : -idComparison;
      }

      return 0;
    });
  }

  /**
   * Apply pagination to entities
   */
  private applyPagination(entities: D[], criteria: Criteria): { data: D[]; hasNext?: boolean } {
    let result = entities;
    let hasNext: boolean | undefined;

    if (criteria.pagination.type === 'offset') {
      const offset = (criteria.pagination as PaginationOffset).offset;
      const limit = criteria.pagination.limit;

      if (limit === 0) {
        result = result.slice(offset);
        hasNext = false;
      } else {
        // Fetch one extra to check hasNext
        result = result.slice(offset, offset + limit + 1);
        hasNext = result.length > limit;
        result = result.slice(0, limit);
      }
    } else if (criteria.pagination.type === 'cursor') {
      result = this.applyCursorPagination(entities, criteria);
      const limit = criteria.pagination.limit;

      if (limit > 0) {
        // Fetch one extra to check hasNext
        const sliced = result.slice(0, limit + 1);
        hasNext = sliced.length > limit;
        result = sliced.slice(0, limit);
      }
    }

    return { data: result, hasNext };
  }

  /**
   * Apply cursor-based pagination
   */
  private applyCursorPagination(entities: D[], criteria: Criteria): D[] {
    if (criteria.pagination.type !== 'cursor') {
      return entities;
    }

    const paginationCursor = criteria.pagination as PaginationCursor;

    if (!paginationCursor.cursor || !criteria.order.hasOrder()) {
      return entities;
    }

    const orderBy = criteria.order.orderBy.toValue();
    const isAsc = criteria.order.orderType.isAsc();
    const decodedCursor = paginationCursor.decodeCursor();

    return entities.filter((entity) => {
      const entityValue = Data.getNestedValue(entity, orderBy);
      const entityId = entity.id;

      const parsedEntityValue = Data.parseFromString(String(entityValue));
      const parsedAfter = Data.parseFromString(String(decodedCursor.after));

      const valueComparison = Data.compareValues(parsedEntityValue, parsedAfter);

      if (isAsc) {
        return (
          valueComparison > 0 ||
          (valueComparison === 0 && String(entityId) > decodedCursor.tiebreakerId)
        );
      } else {
        return (
          valueComparison < 0 ||
          (valueComparison === 0 && String(entityId) < decodedCursor.tiebreakerId)
        );
      }
    });
  }
}
