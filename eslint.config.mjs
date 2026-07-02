import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

import noDirectEntityMutationRule from './eslint/rules/no-direct-entity-mutation.mjs';
import { hexagonalArchitectureConfigs } from './eslint/rules/hexagonal-architecture.mjs';
import cqrsHandlerCollocationRule from './eslint/rules/cqrs-handler-collocation.mjs';
import valueObjectNamingRule from './eslint/rules/value-object-naming.mjs';
import noDirectCqrsDecoratorsRule from './eslint/rules/no-direct-cqrs-decorators.mjs';
import domainEventHandlerBaseRule from './eslint/rules/domain-event-handler-base.mjs';
import commandHandlerBaseRule from './eslint/rules/command-handler-base.mjs';
import queryHandlerBaseRule from './eslint/rules/query-handler-base.mjs';
import aggregateBaseRule from './eslint/rules/aggregate-base.mjs';
import aggregateDtoBaseRule from './eslint/rules/aggregate-dto-base.mjs';
import repositoryBaseRule from './eslint/rules/repository-base.mjs';
import domainEventBaseRule from './eslint/rules/domain-event-base.mjs';
import noCrossBcImportsRule from './eslint/rules/no-cross-bc-imports.mjs';
import handlerNamingRule from './eslint/rules/handler-naming.mjs';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/jest.config.js',
      '**/*.config.js',
      'backend/libs/**/*.spec.ts',
      'backend/libs/**/*.contract.ts',
      'backend/libs/common/src/test-exports/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  // Global settings
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', '*.js', '*.cjs', '*.ts', '*.tsx'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'entity-domain': {
        rules: {
          'no-direct-entity-mutation': noDirectEntityMutationRule,
        },
      },
      cqrs: {
        rules: {
          'handler-collocation': cqrsHandlerCollocationRule,
          'no-direct-decorators': noDirectCqrsDecoratorsRule,
        },
      },
      'command-handler': {
        rules: {
          'must-extend-base': commandHandlerBaseRule,
        },
      },
      'query-handler': {
        rules: {
          'must-extend-base': queryHandlerBaseRule,
        },
      },
      'value-object': {
        rules: {
          naming: valueObjectNamingRule,
        },
      },
      'domain-event-handler': {
        rules: {
          'must-extend-base': domainEventHandlerBaseRule,
        },
      },
      aggregate: {
        rules: {
          'must-extend-base': aggregateBaseRule,
        },
      },
      'aggregate-dto': {
        rules: {
          'must-extend-base': aggregateDtoBaseRule,
        },
      },
      repository: {
        rules: {
          'must-extend-base': repositoryBaseRule,
        },
      },
      'domain-event': {
        rules: {
          'must-extend-base': domainEventBaseRule,
        },
      },
      'bounded-context': {
        rules: {
          'no-cross-imports': noCrossBcImportsRule,
        },
      },
      handler: {
        rules: {
          naming: handlerNamingRule,
        },
      },
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'error',
      eqeqeq: 'error',
      'entity-domain/no-direct-entity-mutation': 'error',
      'cqrs/handler-collocation': 'error',
      'cqrs/no-direct-decorators': 'error',
      'value-object/naming': 'error',
      'domain-event-handler/must-extend-base': 'error',
      'command-handler/must-extend-base': 'error',
      'query-handler/must-extend-base': 'error',
      'aggregate/must-extend-base': 'error',
      'aggregate-dto/must-extend-base': 'error',
      'repository/must-extend-base': 'error',
      'domain-event/must-extend-base': 'error',
      'bounded-context/no-cross-imports': 'error',
      'handler/naming': 'error',
    },
  },

  // Hexagonal Architecture rules
  ...hexagonalArchitectureConfigs,

  // Disable CQRS decorator rule for framework base classes
  {
    files: ['**/libs/common/src/cqrs/**/*.ts'],
    rules: {
      'cqrs/no-direct-decorators': 'off',
    },
  },

  // Tests — allow importing in-memory repos (infrastructure) from application test files
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // Frontend — disable rules that reference unavailable plugins
  {
    files: ['frontend/public-page/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
