// RuleTester suites for the custom rules NOT covered by base-class-rules.test.mjs.
//
// Item 188: 11 of the 15 custom rules had no tests, so a rename or logic slip
// could silently turn a guardrail into a no-op with CI still green. This file
// adds the 9 AST-only rules here; the 2 type-info rules (value-object-naming,
// no-direct-entity-mutation) are covered in rules-typed.test.mjs, which needs a
// TypeScript project service.
//
// Run with: node --test eslint/rules/__tests__/rules.test.mjs
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';

import handlerNaming from '../handler-naming.mjs';
import commandHandlerBase from '../command-handler-base.mjs';
import queryHandlerBase from '../query-handler-base.mjs';
import domainEventHandlerBase from '../domain-event-handler-base.mjs';
import aggregateDtoBase from '../aggregate-dto-base.mjs';
import repositoryBase from '../repository-base.mjs';
import noDirectCqrsDecorators from '../no-direct-cqrs-decorators.mjs';
import cqrsHandlerCollocation from '../cqrs-handler-collocation.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// handler-naming: the class in a *.command-handler.ts (etc.) file must end with
// the matching suffix.
ruleTester.run('handler-naming', handlerNaming, {
  valid: [
    {
      filename: 'create-user.command-handler.ts',
      code: 'export class CreateUser_CommandHandler {}',
    },
    { filename: 'get-user.query-handler.ts', code: 'export class GetUser_QueryHandler {}' },
    // Non-handler file: rule does not apply.
    { filename: 'user.service.ts', code: 'export class WhateverName {}' },
    // Spec files are skipped.
    { filename: 'create-user.command-handler.spec.ts', code: 'export class Wrong {}' },
  ],
  invalid: [
    {
      filename: 'create-user.command-handler.ts',
      code: 'export class CreateUserHandler {}',
      errors: [{ messageId: 'wrongSuffix' }],
    },
    {
      filename: 'get-user.query-handler.ts',
      code: 'export class GetUser_CommandHandler {}',
      errors: [{ messageId: 'wrongSuffix' }],
    },
  ],
});

// command-handler-base: exported class in a *.command-handler.ts must extend
// Base_CommandHandler(X) (a call expression).
ruleTester.run('command-handler-base', commandHandlerBase, {
  valid: [
    {
      filename: 'create-user.command-handler.ts',
      code: 'export class CreateUser_CommandHandler extends Base_CommandHandler(CreateUserCommand) {}',
    },
    // Non-handler file: ignored.
    { filename: 'user.service.ts', code: 'export class Foo {}' },
  ],
  invalid: [
    {
      filename: 'create-user.command-handler.ts',
      code: 'export class CreateUser_CommandHandler {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'create-user.command-handler.ts',
      code: 'export class CreateUser_CommandHandler extends SomethingElse {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'create-user.command-handler.ts',
      code: 'export class CreateUser_CommandHandler extends Base_QueryHandler(X) {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

// query-handler-base: exported class in a *.query-handler.ts must extend
// Base_QueryHandler(X).
ruleTester.run('query-handler-base', queryHandlerBase, {
  valid: [
    {
      filename: 'get-user.query-handler.ts',
      code: 'export class GetUser_QueryHandler extends Base_QueryHandler(GetUserQuery) {}',
    },
    { filename: 'user.service.ts', code: 'export class Foo {}' },
  ],
  invalid: [
    {
      filename: 'get-user.query-handler.ts',
      code: 'export class GetUser_QueryHandler {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'get-user.query-handler.ts',
      code: 'export class GetUser_QueryHandler extends Base_CommandHandler(X) {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

// domain-event-handler-base: exported class in a *.domain-event-handler.ts must
// extend Base_DomainEventHandler(X).
ruleTester.run('domain-event-handler-base', domainEventHandlerBase, {
  valid: [
    {
      filename: 'user-created.domain-event-handler.ts',
      code: 'export class UserCreated_DomainEventHandler extends Base_DomainEventHandler(UserCreated) {}',
    },
    { filename: 'user.service.ts', code: 'export class Foo {}' },
  ],
  invalid: [
    {
      filename: 'user-created.domain-event-handler.ts',
      code: 'export class UserCreated_DomainEventHandler {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'user-created.domain-event-handler.ts',
      code: 'export class UserCreated_DomainEventHandler extends Base_CommandHandler(X) {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

// aggregate-dto-base: an exported *DTO class in a *.dto.ts file under
// /domain/aggregates/ must extend SharedAggregateDTO.
ruleTester.run('aggregate-dto-base', aggregateDtoBase, {
  valid: [
    {
      filename: '/repo/src/bounded-contexts/auth/domain/aggregates/user.dto.ts',
      code: 'export class UserDTO extends SharedAggregateDTO {}',
    },
    // A non-DTO class in the same file is not this rule's concern.
    {
      filename: '/repo/src/bounded-contexts/auth/domain/aggregates/user.dto.ts',
      code: 'export class Helper {}',
    },
    // A .dto.ts outside /domain/aggregates/ is ignored.
    { filename: '/repo/src/other/user.dto.ts', code: 'export class UserDTO {}' },
  ],
  invalid: [
    {
      filename: '/repo/src/bounded-contexts/auth/domain/aggregates/user.dto.ts',
      code: 'export class UserDTO {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: '/repo/src/bounded-contexts/auth/domain/aggregates/user.dto.ts',
      code: 'export class UserDTO extends SomethingElse {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

// repository-base: an exported interface ending Repository/_Repository in a
// *.repository.ts file must extend Repository.
ruleTester.run('repository-base', repositoryBase, {
  valid: [
    {
      filename: 'user.repository.ts',
      code: 'export interface UserRepository extends Repository<User, Id> {}',
    },
    // Interface not ending in Repository: not checked.
    { filename: 'user.repository.ts', code: 'export interface UserThing {}' },
    // base.repository.ts is exempt.
    { filename: 'base.repository.ts', code: 'export interface Repository {}' },
  ],
  invalid: [
    {
      filename: 'user.repository.ts',
      code: 'export interface UserRepository {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
    {
      filename: 'user.repository.ts',
      code: 'export interface User_Repository extends SomethingElse {}',
      errors: [{ messageId: 'mustExtendBase' }],
    },
  ],
});

// no-direct-cqrs-decorators: the raw @CommandHandler/@QueryHandler/@EventsHandler
// decorators are forbidden (extend the base mixin instead).
ruleTester.run('no-direct-cqrs-decorators', noDirectCqrsDecorators, {
  valid: [
    // A different decorator is fine.
    { filename: 'x.ts', code: '@Injectable() export class Foo {}' },
  ],
  invalid: [
    {
      filename: 'x.command-handler.ts',
      code: '@CommandHandler(CreateUser) export class Foo {}',
      errors: [{ messageId: 'noCommandHandler' }],
    },
    {
      filename: 'x.query-handler.ts',
      code: '@QueryHandler(GetUser) export class Foo {}',
      errors: [{ messageId: 'noQueryHandler' }],
    },
    {
      filename: 'x.domain-event-handler.ts',
      code: '@EventsHandler(UserCreated) export class Foo {}',
      errors: [{ messageId: 'noEventsHandler' }],
    },
  ],
});

// cqrs-handler-collocation: a command/query handler must import its own message
// type from a "./" relative path, not via an @bc/... alias.
const CMD_HANDLER =
  '/repo/src/bounded-contexts/auth/application/commands/create-user/create-user.command-handler.ts';
ruleTester.run('cqrs-handler-collocation', cqrsHandlerCollocation, {
  valid: [
    // Relative import of the collocated command: allowed.
    { filename: CMD_HANDLER, code: "import { CreateUser_Command } from './create-user.command';" },
    // A bare specifier that is not the handler's own message type: allowed.
    { filename: CMD_HANDLER, code: "import { Something } from '@libs/nestjs-common';" },
    // Not a handler file: rule does not apply.
    { filename: '/repo/src/user.service.ts', code: "import { X } from '@bc/other/x';" },
  ],
  invalid: [
    // Pulling the collocated command in via an alias instead of "./": flagged.
    {
      filename: CMD_HANDLER,
      code: "import { CreateUser_Command } from '@bc/auth/application/commands/create-user/create-user.command';",
      errors: [{ messageId: 'wrongLocation' }],
    },
  ],
});

console.log(
  'rule suites passed (handler-naming, command/query/domain-event-handler-base, aggregate-dto-base, repository-base, no-direct-cqrs-decorators, cqrs-handler-collocation)',
);
