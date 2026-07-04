import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'no-direct-cqrs-decorators',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct use of @CommandHandler, @QueryHandler, and @EventsHandler decorators. Use Base_CommandHandler, Base_QueryHandler, or Base_DomainEventHandler instead.',
    },
    schema: [],
    messages: {
      noCommandHandler:
        'Do not use @CommandHandler decorator directly. Extend Base_CommandHandler instead: export class MyHandler extends Base_CommandHandler(MyCommand) { ... }',
      noQueryHandler:
        'Do not use @QueryHandler decorator directly. Extend Base_QueryHandler instead: export class MyHandler extends Base_QueryHandler(MyQuery) { ... }',
      noEventsHandler:
        'Do not use @EventsHandler decorator directly. Extend Base_DomainEventHandler instead: export class MyHandler extends Base_DomainEventHandler(MyEvent) { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Decorator(node) {
        // Check if the decorator is a call expression (e.g., @CommandHandler(MyCommand))
        // or an identifier (e.g., @CommandHandler)
        let decoratorName;

        if (node.expression.type === AST_NODE_TYPES.CallExpression) {
          // Handle @CommandHandler(MyCommand)
          if (node.expression.callee.type === AST_NODE_TYPES.Identifier) {
            decoratorName = node.expression.callee.name;
          }
        } else if (node.expression.type === AST_NODE_TYPES.Identifier) {
          // Handle @CommandHandler without arguments
          decoratorName = node.expression.name;
        }

        if (!decoratorName) {
          return;
        }

        // Check for prohibited decorators
        if (decoratorName === 'CommandHandler') {
          context.report({
            node,
            messageId: 'noCommandHandler',
          });
        } else if (decoratorName === 'QueryHandler') {
          context.report({
            node,
            messageId: 'noQueryHandler',
          });
        } else if (decoratorName === 'EventsHandler') {
          context.report({
            node,
            messageId: 'noEventsHandler',
          });
        }
      },
    };
  },
});
