import type { Criteria } from './criteria';
import type { SharedAggregateDTO } from '../base.aggregate';
import type { Primitives } from '../value-objects/base.vo';
import { PaginationCursor } from './pagination/pagination-cursor';

export interface CriteriaQueryResult<D extends SharedAggregateDTO> {
  data: D[];
  total: number | null;
  hasNext?: boolean;
  cursor?: string;
}
export abstract class CriteriaConverter<D extends SharedAggregateDTO> {
  abstract executeQuery(criteria: Criteria): Promise<CriteriaQueryResult<D>>;
  abstract count(criteria: Criteria): Promise<number>;

  public generateCursor(documents: D[], criteria: Criteria): string | undefined {
    if (documents.length === 0 || !criteria.order.hasOrder()) {
      return undefined;
    }

    const lastItem = documents[documents.length - 1];
    const orderByField = criteria.order.orderBy.toValue();
    const cursorValue = lastItem[orderByField] as Primitives;
    const tiebreakerId = String(lastItem.id);

    return PaginationCursor.encodeCursor(String(cursorValue), tiebreakerId);
  }
}
