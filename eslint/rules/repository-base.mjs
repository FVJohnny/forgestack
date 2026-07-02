import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'repository-base',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that all repository interfaces extend from Repository',
    },
    schema: [],
    messages: {
      mustExtendBase:
        'Repository interfaces must extend Repository: export interface MyRepository extends Repository<MyAggregate, Id> { ... }',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Only apply this rule to .repository.ts files
    if (!filename.endsWith('.repository.ts')) {
      return {};
    }

    // Skip the base repository file itself
    if (filename.endsWith('base.repository.ts')) {
      return {};
    }

    return {
      TSInterfaceDeclaration(node) {
        // Skip if interface is not exported
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
          return;
        }

        // Only check interfaces that end with _Repository or Repository
        if (!node.id || (!node.id.name.endsWith('_Repository') && !node.id.name.endsWith('Repository'))) {
          return;
        }

        // Check if the interface has extends clause
        if (!node.extends || node.extends.length === 0) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
          return;
        }

        // Check if it extends from Repository
        const extendsRepository = node.extends.some((heritage) => {
          if (heritage.expression.type === AST_NODE_TYPES.Identifier) {
            return heritage.expression.name === 'Repository';
          }
          return false;
        });

        if (!extendsRepository) {
          context.report({
            node,
            messageId: 'mustExtendBase',
          });
        }
      },
    };
  },
});
