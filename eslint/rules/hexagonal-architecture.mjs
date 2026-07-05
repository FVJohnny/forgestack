// Hexagonal Architecture ESLint configuration
// Enforces layer boundaries:
//   domain         -> domain only
//   application    -> domain + application
//   infrastructure -> domain + infrastructure
//   interfaces     -> application + interfaces

// The one exemption tests get: in-memory infrastructure fakes (repositories
// and services) may be imported from any layer's spec files. Everything else
// stays restricted; the spec entries below re-state each layer's boundaries
// with only this carve-out. Regex is used instead of gitignore-style groups
// because a `!` negation cannot re-include a path whose parent directory the
// positive pattern already excluded.
const INFRA_EXCEPT_IN_MEMORY = '(^|/)infrastructure/(?!.*in-memory)';
const specsIn = (layerGlob) => [
  `${layerGlob}/**/*.spec.ts`,
  `${layerGlob}/**/*.test.ts`,
  `${layerGlob}/**/test/**/*.ts`,
];

export const hexagonalArchitectureConfigs = [
  // Domain layer rules
  {
    files: ['**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/application/**', '**/infrastructure/**', '**/interfaces/**'],
              message: 'Domain layer should only import from domain layer',
            },
          ],
        },
      ],
    },
  },

  // Application layer rules
  {
    files: ['**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**'],
              message: 'Application layer should only import from domain and application layers',
            },
          ],
        },
      ],
    },
  },

  // Infrastructure layer rules
  {
    files: ['**/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/application/**', '**/interfaces/**'],
              message:
                'Infrastructure layer should only import from domain and infrastructure layers',
            },
          ],
        },
      ],
    },
  },

  // Interfaces layer rules. Scoped to bounded contexts because `interfaces/`
  // outside them (e.g. libs/common/src/general/interfaces) is a plain
  // TypeScript-types folder, not a hexagonal layer.
  {
    files: ['**/bounded-contexts/**/interfaces/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/domain/**', '**/infrastructure/**'],
              message:
                'Interfaces layer should only dispatch commands and queries: import from the application layer instead of touching domain or infrastructure directly',
            },
          ],
        },
      ],
    },
  },

  // Spec carve-outs: same boundaries as the layer they live in, but in-memory
  // fakes are allowed for test setup. These entries come after the layer
  // entries so they win for spec files.
  {
    files: specsIn('**/domain'),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `(^|/)application/|${INFRA_EXCEPT_IN_MEMORY}|(^|/)interfaces/`,
              message:
                'Domain spec files may only reach outside the domain layer for in-memory fakes',
            },
          ],
        },
      ],
    },
  },
  {
    files: specsIn('**/application'),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `${INFRA_EXCEPT_IN_MEMORY}|(^|/)interfaces/`,
              message:
                'Application spec files may only reach into infrastructure for in-memory fakes',
            },
          ],
        },
      ],
    },
  },
];
