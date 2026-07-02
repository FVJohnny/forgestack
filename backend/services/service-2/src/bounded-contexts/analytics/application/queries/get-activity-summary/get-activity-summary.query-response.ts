export interface GetActivitySummary_QueryResponse {
  total: number;
  byType: Record<string, number>;
  lastActivityAt: Date | null;
}
