export class Data {
  static parseFromString(value: string): unknown {
    // Try to parse as number first
    const asNumber = Number(value);
    if (!isNaN(asNumber) && isFinite(asNumber)) {
      return asNumber;
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse as Date - only for specific patterns that are unambiguous
    // 1. ISO 8601: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss (with optional ms and timezone)
    // 2. Date.toString() format: "Day Mon DD YYYY HH:mm:ss GMT..."
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/;
    const toStringPattern =
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/;

    if (isoDatePattern.test(value) || toStringPattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }

    // Return as string
    return value;
  }

  static compareValues(a: unknown, b: unknown): number {
    // Handle nullish values using nullish coalescing
    const aIsNullish = a === null || a === undefined;
    const bIsNullish = b === null || b === undefined;

    if (aIsNullish && bIsNullish) return 0;
    if (aIsNullish) return -1;
    if (bIsNullish) return 1;

    // Type-specific comparisons
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }

    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return Number(a) - Number(b);
    }

    // Default to string comparison
    return String(a).localeCompare(String(b));
  }

  static getNestedValue(obj: object, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
