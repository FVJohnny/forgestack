import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  userId?: string;
}

/**
 * Service for storing request-scoped data using AsyncLocalStorage.
 * Allows accessing userId and other request context anywhere in the call chain
 * without explicitly passing it through parameters.
 */
export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<RequestContextData>();

  /**
   * Run a function within a request context
   */
  static run<T>(data: RequestContextData, fn: () => T): T {
    return this.storage.run(data, fn);
  }

  /**
   * Get the current request context data
   */
  static getContext(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the userId from the current request context
   */
  static getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }

  /**
   * Set the userId in the current request context
   */
  static setUserId(userId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
    }
  }
}
