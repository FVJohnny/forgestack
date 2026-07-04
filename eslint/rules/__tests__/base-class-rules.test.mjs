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

// eslint-disable-next-line no-console
console.log('base-class rule suites passed (domain-event, integration-event, aggregate)');
