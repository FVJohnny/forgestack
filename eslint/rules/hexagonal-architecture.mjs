// Hexagonal Architecture ESLint configuration
// Enforces layer boundaries:
//   domain         -> domain only
//   application    -> domain + application
//   infrastructure -> domain + infrastructure
//   interfaces     -> application + interfaces

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
];
