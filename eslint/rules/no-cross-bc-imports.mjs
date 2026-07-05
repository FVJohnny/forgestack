import path from 'path';

import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/FVJohnny/nestjs-microservices-framework/blob/main/eslint/rules/${name}.mjs`,
);

const BC_PATH_REGEX = /bounded-contexts\/([^/]+)\//;
const BC_ALIAS_REGEX = /^@bc\/([^/]+)/;

/**
 * Extracts the bounded context name from a file path (or a resolved import
 * path). Returns null if the path is not inside a bounded context.
 */
function getBoundedContext(filePath) {
  const match = filePath.match(BC_PATH_REGEX);
  return match ? match[1] : null;
}

/**
 * Resolves the bounded context an import points at, for BOTH the `@bc/<name>`
 * alias form and relative paths (`../../other-bc/...`) that resolve into a
 * different bounded-contexts/<name> directory. Returns null when the import
 * does not target a bounded context.
 */
function resolveImportedBc(importSource, currentFile) {
  const aliasMatch = importSource.match(BC_ALIAS_REGEX);
  if (aliasMatch) return aliasMatch[1];

  // Only relative specifiers can reach another BC on disk; bare package
  // specifiers (@libs/*, third-party) never do.
  if (importSource.startsWith('.')) {
    const resolved = path.resolve(path.dirname(currentFile), importSource);
    return getBoundedContext(resolved);
  }

  return null;
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

    // Shared check for every import-like node: static import, re-export
    // (`export ... from`), and dynamic `import()`.
    function check(node, source) {
      if (typeof source !== 'string') return;

      const importedBc = resolveImportedBc(source, filename);
      if (!importedBc) return;

      // Same BC — allowed. Shared BC — allowed (cross-cutting layer).
      if (importedBc === currentBc || importedBc === 'shared') return;

      context.report({
        node,
        messageId: 'crossBcImport',
        data: { importedBc, currentBc },
      });
    }

    return {
      // import ... from '...'
      ImportDeclaration(node) {
        check(node.source, node.source.value);
      },
      // export ... from '...'  and  export * from '...'
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node.source, node.source.value);
      },
      // dynamic import('...') with a string-literal argument
      ImportExpression(node) {
        if (node.source && node.source.type === 'Literal') {
          check(node.source, node.source.value);
        }
      },
    };
  },
});
