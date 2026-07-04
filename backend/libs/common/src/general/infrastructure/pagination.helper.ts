export interface PaginatedRepoResult<T> {
  data: T[];
  total: number | null;
  cursor?: string;
  hasNext?: boolean;
}
