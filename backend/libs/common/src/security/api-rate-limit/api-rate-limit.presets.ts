import { RateLimit } from './api-rate-limit.decorator';

export const StandardRateLimit = () =>
  RateLimit({
    '1second': { type: 'user', limit: 3 },
    '1minute': { type: 'user', limit: 10 },
  });

export const RelaxedRateLimit = () =>
  RateLimit({
    '1second': { type: 'user', limit: 10 },
    '1minute': { type: 'user', limit: 100 },
  });

export const StrictRateLimit = () =>
  RateLimit({
    '1second': { type: 'user', limit: 1 },
    '1minute': { type: 'user', limit: 5 },
    '1hour': { type: 'user', limit: 50 },
  });
