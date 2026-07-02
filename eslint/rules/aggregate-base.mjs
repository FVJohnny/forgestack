import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'aggregate-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all aggregate classes extend from SharedAggregate',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Aggregate classes must extend SharedAggregate: export class MyAggregate extends SharedAggregate { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .aggregate.ts files
    if (!filename.endsWith('.aggregate.ts')) {
      return {};
    }

    // Skip the base aggregate file itself
    if (filename.endsWith('base.aggregate.ts')) {
      return {};
    }

    return {
      ClassDeclaration(node) {
        // Skip if class is not exported
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
          return;
        }

        // Skip DTO classes or other non-aggregate classes
        if (node.id && node.id.name.endsWith('DTO')) {
          return;
        }

        // Check if the class has a superClass (extends something)
        if (!node.superClass) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if it extends from SharedAggregate (direct identifier, not a function call)
        if (node.superClass.type !== AST_NODE_TYPES.Identifier) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if the identifier is SharedAggregate
        if (node.superClass.name !== 'SharedAggregate') {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
