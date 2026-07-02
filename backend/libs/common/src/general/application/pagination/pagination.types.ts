export type PaginationOrder = 'asc' | 'desc' | 'none';

export interface PaginationOffsetParams {
  limit?: number;
  offset?: number;
  withTotal?: boolean;
  sort: {
    field?: string;
    order?: PaginationOrder;
  };
}

export interface PageResultOffset<T> {
  data: T[];
  pagination: {
    hasNext: boolean;
    total?: number | null;
  };
}

export interface PaginationCursorParams {
  limit?: number;
  cursor?: string;
  sort?: {
    field: string;
    order: PaginationOrder;
  };
}
export interface PageResultCursor<T> {
  data: T[];
  pagination: {
    hasNext: boolean;
    cursor?: string;
  };
}
