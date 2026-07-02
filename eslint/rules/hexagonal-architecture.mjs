// Hexagonal Architecture ESLint configuration
// Enforces layer boundaries: Domain -> Domain only, Application -> Domain+Application, Infrastructure -> Domain+Infrastructure

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
              group: ['**/application/**', '**/infrastructure/**'],
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
              group: ['**/infrastructure/**'],
              message: 'Application layer should only import from domain and application layers',
            },
          ],
        },
      ],
    },
  },

  // // Infrastructure layer rules
  // {
  //   files: ['**/infrastructure/**/*.ts'],
  //   rules: {
  //     'no-restricted-imports': [
  //       'error',
  //       {
  //         patterns: [
  //           {
  //             group: ['**/application/**'],
  //             message: 'Infrastructure layer should only import from domain and infrastructure layers',
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // },
];
