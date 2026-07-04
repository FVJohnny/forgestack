export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
