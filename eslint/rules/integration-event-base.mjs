import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/FVJohnny/nestjs-microservices-framework/blob/main/eslint/rules/${name}.mjs`,
);

export default createRule({
  name: 'integration-event-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all integration event classes extend from Base_IntegrationEvent',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Integration event classes must extend Base_IntegrationEvent: export class MyEvent_IntegrationEvent extends Base_IntegrationEvent { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .integration-event.ts files
    if (!filename.endsWith('.integration-event.ts')) {
      return {};
    }

    // Skip the base integration event file itself
    if (filename.endsWith('base.integration-event.ts')) {
      return {};
    }

    return {
      ClassDeclaration(node) {
        // Skip if class is not exported
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
          return;
        }

        // Only check classes that end with _IntegrationEvent
        if (!node.id || !node.id.name.endsWith('_IntegrationEvent')) {
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

        // Check if it extends from Base_IntegrationEvent (direct identifier)
        if (node.superClass.type !== AST_NODE_TYPES.Identifier) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if the identifier is Base_IntegrationEvent
        if (node.superClass.name !== 'Base_IntegrationEvent') {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
