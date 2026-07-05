import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key marking a route (or controller) as publicly accessible, i.e.
 * exempt from the global JwtAuthGuard. Security is opt-OUT: every route requires
 * a valid session unless it is explicitly marked public.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as public (no authentication required). Use this
 * for genuinely anonymous endpoints (login, register, password-reset request,
 * the OAuth callback, etc.). Prefer this over silently omitting a guard so the
 * intent is explicit and the global guard knows to skip it.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
