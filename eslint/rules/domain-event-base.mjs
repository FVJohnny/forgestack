import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'domain-event-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all domain event classes extend from Base_DomainEvent',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Domain event classes must extend Base_DomainEvent: export class MyEvent_DomainEvent extends Base_DomainEvent { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .domain-event.ts files
    if (!filename.endsWith('.domain-event.ts')) {
      return {};
    }

    // Skip the base domain event file itself
    if (filename.endsWith('base.domain-event.ts')) {
      return {};
    }

    return {
      ClassDeclaration(node) {
        // Skip if class is not exported
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
          return;
        }

        // Only check classes that end with _DomainEvent
        if (!node.id || !node.id.name.endsWith('_DomainEvent')) {
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

        // Check if it extends from Base_DomainEvent (direct identifier)
        if (node.superClass.type !== AST_NODE_TYPES.Identifier) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if the identifier is Base_DomainEvent
        if (node.superClass.name !== 'Base_DomainEvent') {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
