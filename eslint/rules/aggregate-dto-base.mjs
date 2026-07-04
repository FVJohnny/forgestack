import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'aggregate-dto-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all aggregate DTO classes extend from SharedAggregateDTO',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Aggregate DTO classes must extend SharedAggregateDTO: export class MyAggregateDTO extends SharedAggregateDTO { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .dto.ts files in domain/aggregates folders
    if (!filename.endsWith('.dto.ts') || !filename.includes('/domain/aggregates/')) {
      return {};
    }

    // Skip the base DTO file itself
    if (filename.endsWith('base.dto.ts') || filename.includes('SharedAggregateDTO')) {
      return {};
    }

    return {
      ClassDeclaration(node) {
        // Skip if class is not exported
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
          return;
        }

        // Only check classes that end with DTO
        if (!node.id || !node.id.name.endsWith('DTO')) {
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

        // Check if it extends from SharedAggregateDTO (direct identifier)
        if (node.superClass.type !== AST_NODE_TYPES.Identifier) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if the identifier is SharedAggregateDTO
        if (node.superClass.name !== 'SharedAggregateDTO') {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
