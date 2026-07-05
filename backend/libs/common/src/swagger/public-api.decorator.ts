import { applyDecorators, SetMetadata } from '@nestjs/common';
import { DECORATORS } from '@nestjs/swagger/dist/constants';

import { IS_PUBLIC_KEY } from '../auth/public.decorator';

/**
 * Marks an endpoint as public: both in Swagger (removes the bearer-auth
 * requirement from the docs) AND for the runtime global JwtAuthGuard (exempts
 * it from authentication). Composing both keeps one decorator as the single
 * source of truth for "this endpoint is anonymous", so the docs and the actual
 * enforcement cannot drift.
 */
export const PublicApi = () =>
  applyDecorators(SetMetadata(DECORATORS.API_SECURITY, []), SetMetadata(IS_PUBLIC_KEY, true));
