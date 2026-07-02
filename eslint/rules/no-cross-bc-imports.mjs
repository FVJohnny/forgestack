import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

const BC_PATH_REGEX = /bounded-contexts\/([^/]+)\//;
const BC_ALIAS_REGEX = /^@bc\/([^/]+)/;

/**
 * Extracts the bounded context name from a file path or import path.
 * Returns null if the path is not inside a bounded context.
 */
function getBoundedContext(filePath) {
  const match = filePath.match(BC_PATH_REGEX);
  return match ? match[1] : null;
}

/**
 * Extracts the bounded context name from an import source using the @bc/ alias.
 */
function getBoundedContextFromImport(importSource) {
  const match = importSource.match(BC_ALIAS_REGEX);
  return match ? match[1] : null;
}

export default createRule({
  name: 'no-cross-bc-imports',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent direct imports between bounded contexts. Use integration events instead.',
    },
    schema: [],
    messages: {
      crossBcImport:
        'Direct import from bounded context "{{ importedBc }}" is not allowed in "{{ currentBc }}". Use integration events to communicate between bounded contexts. Imports from "shared" are allowed.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    const currentBc = getBoundedContext(filename);

    // Not inside a bounded context — skip
    if (!currentBc) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Check @bc/ alias imports
        const importedBc = getBoundedContextFromImport(source);
        if (!importedBc) return;

        // Same BC — allowed
        if (importedBc === currentBc) return;

        // Shared BC — allowed (it's the cross-cutting concerns layer)
        if (importedBc === 'shared') return;

        context.report({
          node: node.source,
          messageId: 'crossBcImport',
          data: {
            importedBc,
            currentBc,
          },
        });
      },
    };
  },
});
