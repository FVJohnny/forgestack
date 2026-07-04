import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'command-handler-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all command handler classes extend from Base_CommandHandler',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Command handler classes must extend Base_CommandHandler: export class MyHandler extends Base_CommandHandler(MyCommand) { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .command-handler.ts files
    if (!filename.endsWith('.command-handler.ts')) {
      return {};
    }

    return {
      ClassDeclaration(node) {
        // Skip if class is not exported
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
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

        // Check if it extends from a CallExpression (function call like Base_CommandHandler(...))
        if (node.superClass.type !== AST_NODE_TYPES.CallExpression) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if the callee is Base_CommandHandler
        const callee = node.superClass.callee;
        if (callee.type !== AST_NODE_TYPES.Identifier || callee.name !== 'Base_CommandHandler') {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
