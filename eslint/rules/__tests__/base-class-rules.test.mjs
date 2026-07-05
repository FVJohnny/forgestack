// RuleTester suites for the "class must extend base X" family of custom rules.
//
// These are the guardrails that item 94 proved can silently break (a wrong
// base-class name made no-direct-entity-mutation a no-op). Each suite asserts
// BOTH that a correct class passes AND that a wrong/missing base class is
// flagged, so a future rename can't turn a rule into dead code without a red
// test.
//
// Run with: node --test eslint/rules/__tests__/base-class-rules.test.mjs
// (wired into `npm run test:eslint-rules`).
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';

import domainEventBase from '../domain-event-base.mjs';
import integrationEventBase from '../integration-event-base.mjs';
import aggregateBase from '../aggregate-base.mjs';
import noCrossBcImports from '../no-cross-bc-imports.mjs';

// These rules gate on context.filename and only read the AST (no type info),
// so a plain @typescript-eslint/parser with no project service is enough.
const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('domain-event-base', domainEventBase, {
  valid: [
    {
      filename: 'user-registered.domain-event.ts',
      code: 'export class UserRegistered_DomainEvent extends Base_DomainEvent {}',
    },
    // Wrong suffix in a matching file: not this rule's concern -> allowed.
    {
      filename: 'helper.domain-event.ts',
      code: 'export class Helper {}',
    },
    // Non-matching filename is ignored entirely.
    {
      filename: 'user.service.ts',
      code: 'export class UserRegistered_DomainEvent {}',
    },
    // The base file itself is exempt.
    {
      filename: 'base.domain-event.ts',
      code: 'export class Base_DomainEvent {}',
    },
  ],
  invalid: [
    {
      filename: 'user-registered.domain-event.ts',
      code: 'export class UserRegistered_DomainEvent {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'user-registered.domain-event.ts',
      code: 'export class UserRegistered_DomainEvent extends SomethingElse {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

ruleTester.run('integration-event-base', integrationEventBase, {
  valid: [
    {
      filename: 'user-created.integration-event.ts',
      code: 'export class UserCreated_IntegrationEvent extends Base_IntegrationEvent {}',
    },
    {
      filename: 'base.integration-event.ts',
      code: 'export class Base_IntegrationEvent {}',
    },
    {
      filename: 'user.service.ts',
      code: 'export class UserCreated_IntegrationEvent {}',
    },
  ],
  invalid: [
    {
      filename: 'user-created.integration-event.ts',
      code: 'export class UserCreated_IntegrationEvent {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'user-created.integration-event.ts',
      code: 'export class UserCreated_IntegrationEvent extends Base_DomainEvent {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

ruleTester.run('aggregate-base', aggregateBase, {
  valid: [
    {
      filename: 'user.aggregate.ts',
      code: 'export class User extends SharedAggregate {}',
    },
    // DTO classes in an aggregate file are explicitly exempt.
    {
      filename: 'user.aggregate.ts',
      code: 'export class UserDTO {}',
    },
    {
      filename: 'base.aggregate.ts',
      code: 'export class SharedAggregate {}',
    },
  ],
  invalid: [
    {
      filename: 'user.aggregate.ts',
      code: 'export class User {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'user.aggregate.ts',
      code: 'export class User extends SomethingElse {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

// no-cross-bc-imports: catches BOTH the @bc/ alias form and relative paths /
// re-exports / dynamic imports that reach into another bounded context.
const AUTH_FILE =
  '/repo/backend/services/service-1/src/bounded-contexts/auth/application/handler.ts';
ruleTester.run('no-cross-bc-imports', noCrossBcImports, {
  valid: [
    // Same BC (relative) — allowed.
    { filename: AUTH_FILE, code: "import { X } from '../domain/x';" },
    // shared BC — allowed.
    { filename: AUTH_FILE, code: "import { X } from '@bc/shared/x';" },
    { filename: AUTH_FILE, code: "import { X } from '@bc/auth/x';" },
    // Bare package specifier — never a BC.
    { filename: AUTH_FILE, code: "import { X } from '@libs/nestjs-common';" },
    // File outside any bounded context — rule does not apply.
    {
      filename: '/repo/backend/services/service-1/src/main.ts',
      code: "import { X } from '@bc/notifications/x';",
    },
  ],
  invalid: [
    // @bc/ alias into another BC.
    {
      filename: AUTH_FILE,
      code: "import { X } from '@bc/notifications/domain/x';",
      errors: [{ messageId: 'crossBcImport' }],
    },
    // Relative path into another BC (the bypass item 100 called out).
    {
      filename: AUTH_FILE,
      code: "import { X } from '../../notifications/domain/x';",
      errors: [{ messageId: 'crossBcImport' }],
    },
    // Re-export from another BC.
    {
      filename: AUTH_FILE,
      code: "export { X } from '@bc/notifications/x';",
      errors: [{ messageId: 'crossBcImport' }],
    },
    // export * from another BC.
    {
      filename: AUTH_FILE,
      code: "export * from '../../notifications/x';",
      errors: [{ messageId: 'crossBcImport' }],
    },
    // Dynamic import() into another BC.
    {
      filename: AUTH_FILE,
      code: "const m = import('../../notifications/x');",
      errors: [{ messageId: 'crossBcImport' }],
    },
  ],
});

console.log('rule suites passed (domain-event, integration-event, aggregate, no-cross-bc-imports)');
