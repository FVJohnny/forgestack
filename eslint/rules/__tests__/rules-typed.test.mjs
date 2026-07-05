// RuleTester suites for the two custom rules that need TYPE information:
// value-object-naming and no-direct-entity-mutation (item 188). These walk base
// types via the type checker, so RuleTester runs with a TypeScript project
// service pointed at ./fixtures (which defines IValueObject and SharedAggregate).
//
// Run with: node --test eslint/rules/__tests__/rules-typed.test.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { RuleTester } from '@typescript-eslint/rule-tester';

import valueObjectNaming from '../value-object-naming.mjs';
import noDirectEntityMutation from '../no-direct-entity-mutation.mjs';

// The typed RuleTester expects the ambient test hooks to exist. Wire them to
// node:test so this runs under `node --test` (node:test exposes `after`, not
// the Jest-style `afterAll`).
RuleTester.afterAll = after;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts'],
      },
      tsconfigRootDir: fixtures,
    },
  },
});

const IMPORT = "import { IValueObject, SharedAggregate } from './base-defs';\n";

// value-object-naming: a class implementing IValueObject must live in a *.vo.ts
// file, and a *.vo.ts file must contain an IValueObject implementer.
ruleTester.run('value-object-naming', valueObjectNaming, {
  valid: [
    {
      filename: join(fixtures, 'email.vo.ts'),
      code: IMPORT + 'export class Email implements IValueObject { equals() { return true; } }',
    },
    // A plain class in a non-vo file: rule does not apply.
    {
      filename: join(fixtures, 'helper.ts'),
      code: 'export class Helper {}',
    },
  ],
  invalid: [
    // Implements IValueObject but the file is not *.vo.ts.
    {
      filename: join(fixtures, 'email.ts'),
      code: IMPORT + 'export class Email implements IValueObject { equals() { return true; } }',
      errors: [{ messageId: 'iValueObjectMustBeVoFile' }],
    },
    // A *.vo.ts file with no IValueObject implementer.
    {
      filename: join(fixtures, 'empty.vo.ts'),
      code: 'export class NotAValueObject {}',
      errors: [{ messageId: 'voFileMustImplementIValueObject' }],
    },
  ],
});

// no-direct-entity-mutation: assigning to a property of an object whose type
// extends SharedAggregate (other than `this`) is forbidden.
ruleTester.run('no-direct-entity-mutation', noDirectEntityMutation, {
  valid: [
    // Mutating a non-aggregate object is fine.
    {
      filename: join(fixtures, 'ok.ts'),
      code: 'const plain = { name: "a" }; plain.name = "b";',
    },
    // `this.x =` inside the aggregate itself is allowed.
    {
      filename: join(fixtures, 'agg-internal.ts'),
      code:
        IMPORT +
        'export class User extends SharedAggregate { rename() { (this as any).name = "x"; } }',
    },
  ],
  invalid: [
    // Reaching into an aggregate instance and mutating a property.
    {
      filename: join(fixtures, 'mutate.ts'),
      code:
        IMPORT +
        'export class User extends SharedAggregate { name = ""; }\n' +
        'function bad(u: User) { u.name = "x"; }',
      errors: [{ messageId: 'noDirectMutation' }],
    },
  ],
});

console.log('typed rule suites passed (value-object-naming, no-direct-entity-mutation)');
