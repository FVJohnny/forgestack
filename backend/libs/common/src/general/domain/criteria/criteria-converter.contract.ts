import type { CriteriaConverter } from './criteria-converter';
import { Criteria } from './criteria';
import { Filter } from './filters/filter';
import { FilterField } from './filters/filter-field.vo';
import { FilterOperator, Operator } from './filters/filter-operator.vo';
import { FilterValue } from './filters/filter-value.vo';
import { Filters } from './filters/filters';
import { Order } from './order/order';
import { OrderBy } from './order/order-by.vo';
import { OrderType, OrderTypes } from './order/order-type.vo';
import { PaginationCursor } from './pagination/pagination-cursor';
import { PaginationOffset } from './pagination/pagination-offset';
import type { SharedAggregateDTO } from '../base.aggregate';

/**
 * Test entity for CriteriaConverter tests
 */
export interface TestEntityDTO extends SharedAggregateDTO {
  id: string;
  name: string;
  value: number;
  category: string;
  status: string;
  description?: string;
  score?: number;
  price?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Factory function to create test entities
 */
function createTestEntities(count: number, template?: Partial<TestEntityDTO>): TestEntityDTO[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => ({
    id: `entity-${i + 1}`,
    name: `Item ${i + 1}`,
    value: (i + 1) * 10,
    category: String.fromCharCode(65 + (i % 3)), // A, B, C
    status: i % 2 === 1 ? 'active' : 'inactive',
    score: (i + 1) * 5,
    price: (i + 1) * 25.5,
    createdAt: new Date(now.getTime() - (count - i) * 1000 * 60), // 1 minute apart
    updatedAt: new Date(now.getTime() - (count - i) * 1000 * 30), // 30 seconds apart
    ...template,
  }));
}

/**
 * Helper to create a filter
 */
function createFilter(field: string, operator: Operator, value: string | number | boolean) {
  return new Filter(new FilterField(field), new FilterOperator(operator), new FilterValue(value));
}

/**
 * Shared test suite for CriteriaConverter implementations.
 * This ensures all implementations behave consistently and meet the interface contract.
 *
 * @param description Name of the implementation being tested
 * @param createConverter Factory function to create a converter with test data
 */
export function testCriteriaConverterContract<T extends CriteriaConverter<TestEntityDTO>>(
  description: string,
  createConverter: (entities: TestEntityDTO[]) => Promise<T>,
) {
  describe(`CriteriaConverter Contract: ${description}`, () => {
    let converter: T;
    let testEntities: TestEntityDTO[];

    describe('Empty Criteria', () => {
      beforeEach(async () => {
        testEntities = createTestEntities(5);
        converter = await createConverter(testEntities);
      });

      it('should return all items with default pagination when criteria is empty', async () => {
        const result = await converter.executeQuery(new Criteria());

        expect(result.data).toHaveLength(5);
        expect(result.data.map((e) => e.id).sort()).toEqual([
          'entity-1',
          'entity-2',
          'entity-3',
          'entity-4',
          'entity-5',
        ]);
        expect(result.total).toBeNull(); // Default doesn't request total
        expect(result.hasNext).toBe(false);
        expect(result.cursor).toBeUndefined();
      });

      it('should count all items when criteria is empty', async () => {
        const count = await converter.count(new Criteria());
        expect(count).toBe(5);
      });
    });

    describe('Filtering', () => {
      beforeEach(async () => {
        testEntities = createTestEntities(10);
        converter = await createConverter(testEntities);
      });

      describe('EQUAL operator', () => {
        it('should filter by string equality', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('status', Operator.EQUAL, 'active')]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data.every((e) => e.status === 'active')).toBe(true);
          expect(result.data).toHaveLength(5); // Even numbered items are active
        });

        it('should filter by number equality', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('value', Operator.EQUAL, 30)]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data).toHaveLength(1);
          expect(result.data[0].value).toBe(30);
          expect(result.data[0].id).toBe('entity-3');
        });

        it('should handle no matches', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('category', Operator.EQUAL, 'Z')]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data).toHaveLength(0);
        });
      });

      describe('NOT_EQUAL operator', () => {
        it('should filter by string inequality', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('status', Operator.NOT_EQUAL, 'active')]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data.every((e) => e.status !== 'active')).toBe(true);
          expect(result.data).toHaveLength(5); // Odd numbered items are inactive
        });
      });

      describe('GT operator', () => {
        it('should filter by greater than', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('value', Operator.GT, 50)]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data.every((e) => e.value > 50)).toBe(true);
          expect(result.data).toHaveLength(5); // Items 6-10
          expect(result.data.map((e) => e.id).sort()).toEqual([
            'entity-10',
            'entity-6',
            'entity-7',
            'entity-8',
            'entity-9',
          ]);
        });
      });

      describe('LT operator', () => {
        it('should filter by less than', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('value', Operator.LT, 40)]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data.every((e) => e.value < 40)).toBe(true);
          expect(result.data).toHaveLength(3); // Items 1-3
        });
      });

      describe('CONTAINS operator', () => {
        it('should filter by string contains (case-insensitive)', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('name', Operator.CONTAINS, 'item 1')]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data).toHaveLength(2); // "Item 1" and "Item 10"
          expect(result.data.map((e) => e.id).sort()).toEqual(['entity-1', 'entity-10']);
        });
      });

      describe('NOT_CONTAINS operator', () => {
        it('should filter by string not contains', async () => {
          const criteria = new Criteria({
            filters: new Filters([createFilter('name', Operator.NOT_CONTAINS, '1')]),
          });

          const result = await converter.executeQuery(criteria);
          expect(result.data.every((e) => !e.name.includes('1'))).toBe(true);
          expect(result.data).toHaveLength(8); // All except Item 1 and Item 10
        });
      });

      describe('Multiple filters', () => {
        it('should apply multiple filters with AND logic', async () => {
          const criteria = new Criteria({
            filters: new Filters([
              createFilter('status', Operator.EQUAL, 'active'),
              createFilter('value', Operator.GT, 40),
              createFilter('category', Operator.EQUAL, 'A'),
            ]),
          });

          const result = await converter.executeQuery(criteria);
          expect(
            result.data.every((e) => e.status === 'active' && e.value > 40 && e.category === 'A'),
          ).toBe(true);
          // Active (even): 2,4,6,8,10; > 40: 5-10; category A (1,4,7,10): 10
          expect(result.data.map((e) => e.id)).toEqual(['entity-10']);
        });
      });
    });

    describe('Sorting', () => {
      beforeEach(async () => {
        testEntities = [
          { ...createTestEntities(1)[0], id: 'entity-1', name: 'Charlie', value: 30, score: 15 },
          { ...createTestEntities(1)[0], id: 'entity-2', name: 'Alice', value: 10, score: 25 },
          { ...createTestEntities(1)[0], id: 'entity-3', name: 'Bob', value: 20, score: 20 },
          { ...createTestEntities(1)[0], id: 'entity-4', name: 'David', value: 40, score: 10 },
        ];
        converter = await createConverter(testEntities);
      });

      it('should sort by string field ascending', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('name'), new OrderType(OrderTypes.ASC)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.map((e) => e.name)).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
      });

      it('should sort by string field descending', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('name'), new OrderType(OrderTypes.DESC)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.map((e) => e.name)).toEqual(['David', 'Charlie', 'Bob', 'Alice']);
      });

      it('should sort by number field ascending', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.map((e) => e.value)).toEqual([10, 20, 30, 40]);
      });

      it('should sort by number field descending', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('score'), new OrderType(OrderTypes.DESC)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.map((e) => e.score)).toEqual([25, 20, 15, 10]);
      });

      it('should handle no sorting when order type is NONE', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('name'), new OrderType(OrderTypes.NONE)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(4);
        // Order may vary by implementation when no sort is specified
      });

      it('should sort with filters applied', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('value', Operator.GT, 15)]),
          order: new Order(new OrderBy('name'), new OrderType(OrderTypes.ASC)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(3);
        expect(result.data.map((e) => e.name)).toEqual(['Bob', 'Charlie', 'David']);
      });
    });

    describe('Pagination - Offset', () => {
      beforeEach(async () => {
        testEntities = createTestEntities(20);
        converter = await createConverter(testEntities);
      });

      it('should apply limit', async () => {
        const criteria = new Criteria({
          pagination: new PaginationOffset(5, 0),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(5);
        expect(result.hasNext).toBe(true);
      });

      it('should apply offset', async () => {
        const criteria = new Criteria({
          pagination: new PaginationOffset(5, 5),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(5);
        expect(result.data[0].id).toBe('entity-6');
        expect(result.data[4].id).toBe('entity-10');
      });

      it('should handle offset beyond data size', async () => {
        const criteria = new Criteria({
          pagination: new PaginationOffset(10, 25),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(0);
        expect(result.hasNext).toBe(false);
      });

      it('should return total when requested', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('status', Operator.EQUAL, 'active')]),
          pagination: new PaginationOffset(3, 2, true), // withTotal = true
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(3);
        expect(result.total).toBe(10); // 10 active items out of 20
      });

      it('should handle limit 0 (return all remaining)', async () => {
        const criteria = new Criteria({
          pagination: new PaginationOffset(0, 15),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(5); // Items 16-20
        expect(result.hasNext).toBe(false);
      });

      it('should paginate with sorting', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.DESC)),
          pagination: new PaginationOffset(3, 2),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(3);
        // Descending: 200, 190, 180, 170, 160...
        expect(result.data.map((e) => e.value)).toEqual([180, 170, 160]);
      });
    });

    describe('Pagination - Cursor', () => {
      beforeEach(async () => {
        testEntities = createTestEntities(10);
        converter = await createConverter(testEntities);
      });

      it('should paginate without cursor (first page)', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 3 }),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(3);
        expect(result.data.map((e) => e.value)).toEqual([10, 20, 30]);
        expect(result.cursor).toBeDefined();
        expect(result.hasNext).toBe(true);
      });

      it('should paginate with cursor (subsequent pages)', async () => {
        // First page
        const criteria1 = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 3 }),
        });

        const result1 = await converter.executeQuery(criteria1);
        expect(result1.cursor).toBeDefined();

        // Second page using cursor
        const criteria2 = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 3, cursor: result1.cursor }),
        });

        const result2 = await converter.executeQuery(criteria2);
        expect(result2.data).toHaveLength(3);
        expect(result2.data.map((e) => e.value)).toEqual([40, 50, 60]);
      });

      it('should handle cursor pagination with descending order', async () => {
        const criteria1 = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.DESC)),
          pagination: new PaginationCursor({ limit: 3 }),
        });

        const result1 = await converter.executeQuery(criteria1);
        expect(result1.data.map((e) => e.value)).toEqual([100, 90, 80]);

        const criteria2 = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.DESC)),
          pagination: new PaginationCursor({ limit: 3, cursor: result1.cursor }),
        });

        const result2 = await converter.executeQuery(criteria2);
        expect(result2.data.map((e) => e.value)).toEqual([70, 60, 50]);
      });

      it('should handle cursor pagination with filters', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('status', Operator.EQUAL, 'active')]),
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 2 }),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.map((e) => e.value)).toEqual([20, 40]);

        const criteria2 = new Criteria({
          filters: new Filters([createFilter('status', Operator.EQUAL, 'active')]),
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 2, cursor: result.cursor }),
        });

        const result2 = await converter.executeQuery(criteria2);
        expect(result2.data.map((e) => e.value)).toEqual([60, 80]);
      });

      it('should handle ties with ID as tiebreaker', async () => {
        // Create entities with same value but different IDs
        testEntities = [
          { ...createTestEntities(1)[0], id: 'entity-3', value: 100, score: 50 },
          { ...createTestEntities(1)[0], id: 'entity-1', value: 100, score: 50 },
          { ...createTestEntities(1)[0], id: 'entity-2', value: 100, score: 50 },
          { ...createTestEntities(1)[0], id: 'entity-4', value: 200, score: 60 },
        ];
        converter = await createConverter(testEntities);

        const criteria = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 2 }),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(2);
        // When values are same, should order by ID
        expect(result.data.map((e) => e.id)).toEqual(['entity-1', 'entity-2']);

        const criteria2 = new Criteria({
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 2, cursor: result.cursor }),
        });

        const result2 = await converter.executeQuery(criteria2);
        expect(result2.data.map((e) => e.id)).toEqual(['entity-3', 'entity-4']);
      });

      it('should throw error when cursor pagination is used without order', async () => {
        expect(() => {
          new Criteria({
            pagination: new PaginationCursor({ limit: 3 }),
          });
        }).toThrow('Cursor pagination requires an order value');
      });
    });

    describe('Count method', () => {
      beforeEach(async () => {
        testEntities = createTestEntities(15);
        converter = await createConverter(testEntities);
      });

      it('should count all items without filters', async () => {
        const count = await converter.count(new Criteria());
        expect(count).toBe(15);
      });

      it('should count filtered items', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('status', Operator.EQUAL, 'active')]),
        });

        const count = await converter.count(criteria);
        expect(count).toBe(7);
      });

      it('should count with multiple filters', async () => {
        const criteria = new Criteria({
          filters: new Filters([
            createFilter('status', Operator.EQUAL, 'active'),
            createFilter('value', Operator.GT, 50),
          ]),
        });

        const count = await converter.count(criteria);
        expect(count).toBe(5); // Active and value > 50: items 6,8,10,12,14
      });

      it('should return 0 when no items match', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('category', Operator.EQUAL, 'Z')]),
        });

        const count = await converter.count(criteria);
        expect(count).toBe(0);
      });

      it('should ignore pagination when counting', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('status', Operator.EQUAL, 'active')]),
          pagination: new PaginationOffset(3, 2),
        });

        const count = await converter.count(criteria);
        expect(count).toBe(7); // Should count all matching, ignoring pagination
      });
    });

    describe('Complex scenarios', () => {
      beforeEach(async () => {
        testEntities = createTestEntities(25);
        converter = await createConverter(testEntities);
      });

      it('should handle filters + sorting + offset pagination', async () => {
        const criteria = new Criteria({
          filters: new Filters([
            createFilter('value', Operator.GT, 50),
            createFilter('status', Operator.EQUAL, 'active'),
          ]),
          order: new Order(new OrderBy('value'), new OrderType(OrderTypes.DESC)),
          pagination: new PaginationOffset(3, 2, true),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.every((e) => e.value > 50 && e.status === 'active')).toBe(true);
        expect(result.data[0].value).toBeGreaterThan(result.data[1].value); // Descending
        expect(result.total).toBeGreaterThan(0);
      });

      it('should handle filters + sorting + cursor pagination', async () => {
        const criteria1 = new Criteria({
          filters: new Filters([createFilter('category', Operator.NOT_EQUAL, 'B')]),
          order: new Order(new OrderBy('score'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 4 }),
        });

        const result1 = await converter.executeQuery(criteria1);
        expect(result1.data.every((e) => e.category !== 'B')).toBe(true);
        expect(result1.cursor).toBeDefined();

        const criteria2 = new Criteria({
          filters: new Filters([createFilter('category', Operator.NOT_EQUAL, 'B')]),
          order: new Order(new OrderBy('score'), new OrderType(OrderTypes.ASC)),
          pagination: new PaginationCursor({ limit: 4, cursor: result1.cursor }),
        });

        const result2 = await converter.executeQuery(criteria2);
        expect(result2.data.every((e) => e.category !== 'B')).toBe(true);
        // Scores should be greater than previous page
        expect(Math.min(...result2.data.map((e) => e.score!))).toBeGreaterThan(
          Math.max(...result1.data.map((e) => e.score!)),
        );
      });
    });

    describe('Nested field access', () => {
      beforeEach(async () => {
        testEntities = [
          {
            ...createTestEntities(1)[0],
            id: 'entity-1',
            metadata: { tags: ['important', 'urgent'], priority: 1 },
          },
          {
            ...createTestEntities(1)[0],
            id: 'entity-2',
            metadata: { tags: ['normal'], priority: 2 },
          },
          {
            ...createTestEntities(1)[0],
            id: 'entity-3',
            metadata: { tags: ['important'], priority: 3 },
          },
        ];
        converter = await createConverter(testEntities);
      });

      it('should filter by nested field', async () => {
        const criteria = new Criteria({
          filters: new Filters([createFilter('metadata.priority', Operator.LT, 3)]),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data).toHaveLength(2);
        expect(result.data.map((e) => e.id).sort()).toEqual(['entity-1', 'entity-2']);
      });

      it('should sort by nested field', async () => {
        const criteria = new Criteria({
          order: new Order(new OrderBy('metadata.priority'), new OrderType(OrderTypes.DESC)),
        });

        const result = await converter.executeQuery(criteria);
        expect(result.data.map((e) => e.id)).toEqual(['entity-3', 'entity-2', 'entity-1']);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty dataset', async () => {
        converter = await createConverter([]);

        const result = await converter.executeQuery(new Criteria());
        expect(result.data).toEqual([]);
        expect(result.total).toBeNull();
        expect(result.hasNext).toBe(false);
        expect(result.cursor).toBeUndefined();

        const count = await converter.count(new Criteria());
        expect(count).toBe(0);
      });

      it('should handle single item dataset', async () => {
        converter = await createConverter(createTestEntities(1));

        const result = await converter.executeQuery(new Criteria());
        expect(result.data).toHaveLength(1);
        expect(result.hasNext).toBe(false);
      });

      it('should handle null/undefined values in fields', async () => {
        testEntities = [
          { ...createTestEntities(1)[0], id: 'entity-1', description: 'test' },
          { ...createTestEntities(1)[0], id: 'entity-2', description: undefined },
          { ...createTestEntities(1)[0], id: 'entity-3', description: 'another' },
        ];
        converter = await createConverter(testEntities);

        const criteria = new Criteria({
          filters: new Filters([createFilter('description', Operator.NOT_EQUAL, 'test')]),
        });

        const result = await converter.executeQuery(criteria);
        // Implementation may vary in how they handle null/undefined
        expect(result.data.find((e) => e.id === 'entity-1')).toBeUndefined();
      });
    });
  });
}
