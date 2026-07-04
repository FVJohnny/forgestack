import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';
import path from 'path';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

export default createRule({
  name: 'value-object-naming',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that .vo.ts files implement IValueObject and files implementing IValueObject end with .vo.ts',
    },
    schema: [],
    messages: {
      voFileMustImplementIValueObject:
        'Files ending with .vo.ts must implement IValueObject interface',
      iValueObjectMustBeVoFile:
        'Classes implementing IValueObject must be in files ending with .vo.ts',
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const filename = context.filename;
    const isVoFile = filename.endsWith('.vo.ts');

    function typeImplementsIValueObject(type, seen = new Set()) {
      if (!type || seen.has(type)) {
        return false;
      }

      seen.add(type);

      // Check if the type itself is IValueObject
      const symbol = type.getSymbol() ?? type.aliasSymbol;
      if (symbol && symbol.getName() === 'IValueObject') {
        return true;
      }

      // Check base types
      if ('getBaseTypes' in type) {
        const baseTypes = type.getBaseTypes?.() ?? [];
        if (baseTypes.some((base) => typeImplementsIValueObject(base, seen))) {
          return true;
        }
      }

      // Check for interface implementations
      const apparent = checker.getApparentType(type);
      if (apparent !== type && typeImplementsIValueObject(apparent, seen)) {
        return true;
      }

      // Check if it's a union or intersection type
      if (type.isUnion() || type.isIntersection()) {
        return type.types.some((member) => typeImplementsIValueObject(member, seen));
      }

      return false;
    }

    function symbolImplementsIValueObject(symbol, seen = new Set()) {
      if (!symbol || seen.has(symbol)) {
        return false;
      }

      seen.add(symbol);

      if (symbol.getName() === 'IValueObject') {
        return true;
      }

      for (const declaration of symbol.getDeclarations() ?? []) {
        if (ts.isClassDeclaration(declaration) || ts.isClassExpression(declaration)) {
          // Check implements clause
          for (const heritage of declaration.heritageClauses ?? []) {
            if (heritage.token === ts.SyntaxKind.ImplementsKeyword) {
              for (const type of heritage.types) {
                const typeSymbol = checker.getTypeAtLocation(type.expression).getSymbol();
                if (typeSymbol && symbolImplementsIValueObject(typeSymbol, seen)) {
                  return true;
                }
              }
            }
            // Also check extends clause (for classes extending other value objects)
            if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
              for (const type of heritage.types) {
                const typeSymbol = checker.getTypeAtLocation(type.expression).getSymbol();
                if (typeSymbol && symbolImplementsIValueObject(typeSymbol, seen)) {
                  return true;
                }
              }
            }
          }
        }

        if (ts.isInterfaceDeclaration(declaration)) {
          // Check interface extends
          for (const heritage of declaration.heritageClauses ?? []) {
            for (const type of heritage.types) {
              const typeSymbol = checker.getTypeAtLocation(type.expression).getSymbol();
              if (typeSymbol && symbolImplementsIValueObject(typeSymbol, seen)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    }

    let hasExportedClass = false;
    let hasIValueObjectImplementation = false;

    return {
      ClassDeclaration(node) {
        if (!node.id) {
          return;
        }

        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const symbol = checker.getSymbolAtLocation(tsNode.name);

        if (!symbol) {
          return;
        }

        const type = checker.getTypeAtLocation(tsNode);

        // Check if implements clause has IValueObject
        let implementsIValueObject = false;
        if (node.implements) {
          for (const impl of node.implements) {
            const implType = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(impl));
            if (typeImplementsIValueObject(implType)) {
              implementsIValueObject = true;
              break;
            }
          }
        }

        // Also check via type and symbol if not found
        if (!implementsIValueObject) {
          implementsIValueObject =
            typeImplementsIValueObject(type) || symbolImplementsIValueObject(symbol);
        }

        // Check if the class is exported
        const isExported =
          node.parent?.type === AST_NODE_TYPES.ExportNamedDeclaration ||
          node.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration;

        if (isExported) {
          hasExportedClass = true;
        }

        if (implementsIValueObject) {
          hasIValueObjectImplementation = true;

          // Rule 2: Classes implementing IValueObject must be in .vo.ts files
          if (!isVoFile) {
            context.report({
              node: node.id,
              messageId: 'iValueObjectMustBeVoFile',
            });
          }
        }
      },
      'Program:exit'() {
        // Rule 1: .vo.ts files must have a class that implements IValueObject
        if (isVoFile && hasExportedClass && !hasIValueObjectImplementation) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'voFileMustImplementIValueObject',
          });
        }
      },
    };
  },
});
