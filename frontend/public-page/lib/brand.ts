/**
 * Brand configuration — single source of truth for the product identity.
 * Import BRAND everywhere; never hardcode the product name in components.
 */
export const BRAND = {
  name: 'ForgeStack',
  short: 'ForgeStack',
  /** Tiny label shown under the wordmark. */
  label: 'solid foundation',
  tagline: 'A solid foundation for production-ready apps.',
  /** Public source repository. */
  repoUrl: 'https://github.com/FVJohnny/forgestack',
} as const;
