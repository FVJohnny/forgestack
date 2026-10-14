// Fixture-based suite for the hexagonal-architecture layer-boundary config.
//
// Unlike the other 14 custom rules, this one is not a custom `createRule` but a
// flat-config array that drives the built-in `no-restricted-imports` per layer
// (see eslint/rules/hexagonal-architecture.mjs). That means it cannot be
// exercised with RuleTester, so this suite runs ESLint over fixture source with
// the real config applied and asserts the boundary errors. It is the
// highest-leverage rule (a slip in the INFRA_EXCEPT_IN_MEMORY regex or the
// files-glob ordering would silently stop enforcing a layer boundary with CI
// still green), so it gets the same "wrong case is flagged" coverage the
// base-class rules have.
//
// Run with: node --test eslint/rules/__tests__/hexagonal-architecture.test.mjs
// (wired into `npm run test:eslint-rules`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';

import { hexagonalArchitectureConfigs } from '../hexagonal-architecture.mjs';

const linter = new Linter();

// Feed ESLint the real config array plus a base entry that supplies the parser
// (the way eslint.config.mjs does for the backend globs) and let ESLint resolve
// the `files` globs itself. Passing an array makes Linter.verify apply flat
// config matching against the filename, so the spec carve-outs override the
// layer entries exactly as they do at runtime.
const config = [
  { languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' } },
  ...hexagonalArchitectureConfigs,
];

const lint = (filename, code) => linter.verify(code, config, { filename });

test('domain layer is flagged when it imports from application', () => {
  const messages = lint(
    'backend/services/service-1/src/bounded-contexts/auth/domain/x.ts',
    "import { Thing } from '../application/thing';",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /Domain layer should only import from domain layer/);
});

test('domain layer is clean when it imports only from domain', () => {
  const messages = lint(
    'backend/services/service-1/src/bounded-contexts/auth/domain/x.ts',
    "import { Thing } from '../domain/thing';",
  );
  assert.equal(messages.length, 0);
});

test('application layer is flagged when it imports from infrastructure', () => {
  const messages = lint(
    'backend/services/service-1/src/bounded-contexts/auth/application/x.ts',
    "import { Repo } from '../infrastructure/repo';",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /only import from domain and application layers/);
});

test('interfaces layer is flagged when it touches domain directly', () => {
  const messages = lint(
    'backend/services/service-1/src/bounded-contexts/auth/interfaces/x.controller.ts',
    "import { User } from '../domain/user.aggregate';",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /import from the application layer/);
});

test('the in-memory carve-out lets an application spec import an in-memory fake', () => {
  // This is the fragile INFRA_EXCEPT_IN_MEMORY branch: a spec reaching into
  // infrastructure is allowed only for in-memory fakes.
  const messages = lint(
    'backend/services/service-1/src/bounded-contexts/auth/application/x.spec.ts',
    "import { User_InMemoryRepository } from '../infrastructure/repositories/in-memory/user.in-memory-repository';",
  );
  assert.equal(messages.length, 0);
});

test('an application spec is still flagged for a non-in-memory infrastructure import', () => {
  const messages = lint(
    'backend/services/service-1/src/bounded-contexts/auth/application/x.spec.ts',
    "import { User_MongodbRepository } from '../infrastructure/repositories/mongodb/user.mongodb-repository';",
  );
  assert.equal(messages.length, 1);
  assert.match(messages[0].message, /in-memory fakes/);
});
