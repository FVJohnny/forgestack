import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

/**
 * Maps file suffix to the required class name suffix.
 */
const SUFFIX_MAP = [
  { fileSuffix: '.command-handler.ts', classSuffix: '_CommandHandler' },
  { fileSuffix: '.query-handler.ts', classSuffix: '_QueryHandler' },
  { fileSuffix: '.domain-event-handler.ts', classSuffix: '_DomainEventHandler' },
  { fileSuffix: '.integration-event-handler.ts', classSuffix: '_IntegrationEventHandler' },
];

export default createRule({
  name: 'handler-naming',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that handler class names end with the correct suffix (_CommandHandler, _QueryHandler, _DomainEventHandler, _IntegrationEventHandler)',
    },
    schema: [],
    messages: {
      wrongSuffix:
        'Class "{{ className }}" in a {{ fileType }} file must end with "{{ expectedSuffix }}". Example: MyAction{{ expectedSuffix }}',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;

    // Skip spec/test files
    if (filename.includes('.spec.') || filename.includes('.test.')) {
      return {};
    }

    // Find which handler type this file is
    const match = SUFFIX_MAP.find((entry) => filename.endsWith(entry.fileSuffix));
    if (!match) return {};

    return {
      ClassDeclaration(node) {
        // Only check exported classes
        if (!node.parent || node.parent.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
          return;
        }

        const className = node.id?.name;
        if (!className) return;

        if (!className.endsWith(match.classSuffix)) {
          context.report({
            node: node.id,
            messageId: 'wrongSuffix',
            data: {
              className,
              fileType: match.fileSuffix.replace(/^\./, '').replace(/\.ts$/, ''),
              expectedSuffix: match.classSuffix,
            },
          });
        }
      },
    };
  },
});
