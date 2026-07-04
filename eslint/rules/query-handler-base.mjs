import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'query-handler-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all query handler classes extend from Base_QueryHandler',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Query handler classes must extend Base_QueryHandler: export class MyHandler extends Base_QueryHandler(MyQuery)<MyResponse>() { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .query-handler.ts files
    if (!filename.endsWith('.query-handler.ts')) {
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

        // For query handlers, the pattern is Base_QueryHandler(Query)<Response>()
        // So we need to check for a CallExpression at the top level
        let topLevelNode = node.superClass;

        // If it's a CallExpression with no arguments, drill down to check what's being called
        if (topLevelNode.type === AST_NODE_TYPES.CallExpression) {
          // Check if callee is another CallExpression (for the generic part)
          if (topLevelNode.callee.type === AST_NODE_TYPES.CallExpression) {
            topLevelNode = topLevelNode.callee;
          }
        }

        // Now check if we have a CallExpression (should be Base_QueryHandler(Query))
        if (topLevelNode.type !== AST_NODE_TYPES.CallExpression) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if the callee is Base_QueryHandler
        const callee = topLevelNode.callee;
        if (callee.type !== AST_NODE_TYPES.Identifier || callee.name !== 'Base_QueryHandler') {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
