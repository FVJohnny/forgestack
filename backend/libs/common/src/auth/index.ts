// FRAMEWORK: reusable auth infrastructure (JWT verification, cookie helpers,
// the guards). Keep these as-is.
export * from './auth-cookies';
export * from './csrf.middleware';
export * from './public.decorator';
export * from './jwt-auth.guard';
export * from './jwt-auth.module';
export * from './jwt-auth.types';
export * from './jwt-token.service';
export * from './internal-api-key.guard';
export * from './admin-role.guard';

// EXAMPLE / PRODUCT: the demo's user-token context (its domain model,
// commands/queries, and in-memory repo). This is where the template's auth
// *model* lives; replace it with your own. See backend/libs/common/README.md.
export * from './domain';
export * from './application';
export * from './testing/user-token.in-memory-repository';
