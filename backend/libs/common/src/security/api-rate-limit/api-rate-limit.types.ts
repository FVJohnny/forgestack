export type TimeKey =
  | '1second'
  | '5seconds'
  | '15seconds'
  | '1minute'
  | '5minutes'
  | '15minutes'
  | '1hour'
  | '1day';

export type RateLimitType = 'ip' | 'user' | 'global';

export interface RateLimitConfig {
  type?: RateLimitType;
  limit: number;
}

export type RateLimitOptions = Partial<Record<TimeKey, RateLimitConfig>>;

export const TIME_KEY_TO_TTL: Record<TimeKey, number> = {
  '1second': 1000,
  '5seconds': 5000,
  '15seconds': 15000,
  '1minute': 60000,
  '5minutes': 300000,
  '15minutes': 900000,
  '1hour': 3600000,
  '1day': 86400000,
};
