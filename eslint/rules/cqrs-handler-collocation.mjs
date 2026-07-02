import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import path from 'path';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'cqrs-handler-collocation',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure CQRS handlers only use commands/queries/events from the same directory',
    },
    schema: [],
    messages: {
      wrongLocation:
        '{{ handlerType }} must use {{ messageType }} from the same directory. Expected "{{ expectedImport }}" but got "{{ actualImport }}"',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    const sourceCode = context.sourceCode;

    // Determine handler type and expected message type based on file path
    function getHandlerInfo(filepath) {
      if (filepath.includes('/commands/') && filepath.endsWith('.command-handler.ts')) {
        return {
          handlerType: 'CommandHandler',
          messageType: 'Command',
          pattern: /\.command\.ts$/,
          folderType: 'commands',
        };
      }
      if (filepath.includes('/queries/') && filepath.endsWith('.query-handler.ts')) {
        return {
          handlerType: 'QueryHandler',
          messageType: 'Query',
          pattern: /\.query\.ts$/,
          folderType: 'queries',
        };
      }
      if (
        filepath.includes('/domain-event-handlers/') &&
        filepath.endsWith('.domain-event-handler.ts')
      ) {
        return {
          handlerType: 'DomainEventHandler',
          messageType: 'DomainEvent',
          pattern: /\.domain-event\.ts$/,
          folderType: 'domain-event-handlers',
        };
      }
      return null;
    }

    const handlerInfo = getHandlerInfo(filename);
    if (!handlerInfo) {
      // Not a handler file, skip
      return {};
    }

    const handlerDir = path.dirname(filename);
    const handlerBasename = path.basename(handlerDir);

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        // Skip non-relative imports (e.g., @libs/*, third-party)
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          return;
        }

        // Domain event handlers can dispatch commands/queries - only check for domain event imports
        if (handlerInfo.messageType === 'DomainEvent') {
          const isDomainEventImport = node.specifiers.some((spec) => {
            if (spec.type === AST_NODE_TYPES.ImportSpecifier) {
              const name = spec.imported.name;
              return name.endsWith('_DomainEvent');
            }
            return false;
          });

          if (!isDomainEventImport) {
            return;
          }
        } else {
          // For command/query handlers, check if this import is for the message type
          const isMessageImport =
            handlerInfo.pattern.test(importPath) ||
            importPath.includes(`.${handlerInfo.messageType.toLowerCase()}.`) ||
            importPath.includes(`${handlerInfo.messageType.toLowerCase()}s/`) ||
            node.specifiers.some((spec) => {
              if (spec.type === AST_NODE_TYPES.ImportSpecifier) {
                const name = spec.imported.name;
                return (
                  name.endsWith('_Command') ||
                  name.endsWith('_Query')
                );
              }
              return false;
            });

          if (!isMessageImport) {
            return;
          }
        }

        // Resolve the import path relative to the handler file
        const resolvedPath = path.resolve(handlerDir, importPath);
        const importedDir = path.dirname(resolvedPath);
        const importedBasename = path.basename(importedDir);

        // For domain events, allow imports from domain/events folder
        const isDomainEventFromEventsFolder =
          handlerInfo.messageType === 'DomainEvent' &&
          (resolvedPath.includes('/domain/events/') || importPath.includes('/domain/events/'));

        // Check if import is from a sibling directory within the same handler folder
        const isSameFolder =
          handlerDir === importedDir || // Same directory
          handlerBasename === importedBasename || // Same folder name (handles different naming patterns)
          importedDir.startsWith(handlerDir + '/') || // Subdirectory of handler folder
          isDomainEventFromEventsFolder; // Domain events can come from domain/events

        if (!isSameFolder) {
          // Extract the handler name from the filename
          // e.g., "delete-user.command-handler.ts" -> "delete-user"
          const handlerFilename = path.basename(filename);
          const handlerName = handlerFilename
            .replace('.command-handler.ts', '')
            .replace('.query-handler.ts', '')
            .replace('.domain-event-handler.ts', '');

          // Construct expected import path
          let expectedImport;
          if (handlerInfo.messageType === 'Command') {
            expectedImport = `./${handlerName}.command`;
          } else if (handlerInfo.messageType === 'Query') {
            expectedImport = `./${handlerName}.query`;
          } else if (handlerInfo.messageType === 'DomainEvent') {
            // For domain events, we need to look in the domain/events folder
            expectedImport = `from the same folder or domain/events`;
          }

          context.report({
            node: node.source,
            messageId: 'wrongLocation',
            data: {
              handlerType: handlerInfo.handlerType,
              messageType: handlerInfo.messageType,
              expectedImport,
              actualImport: importPath,
            },
          });
        }
      },
    };
  },
});
