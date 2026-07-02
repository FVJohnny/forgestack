import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/nestjs-microservices-template/eslint-rules/${name}`,
);

function getDisplayName(node, sourceCode) {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }

  return sourceCode.getText(node);
}

export default createRule({
  name: 'no-direct-entity-mutation',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow mutating properties on aggregate roots outside their own behavioural methods',
    },
    schema: [],
    messages: {
      noDirectMutation:
        'Do not assign to {{ entity }}.{{ property }} directly. Invoke a behaviour on the aggregate instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const sourceCode = context.sourceCode;

    function symbolExtendsSharedAggregateRoot(symbol, seen = new Set()) {
      if (!symbol || seen.has(symbol)) {
        return false;
      }

      seen.add(symbol);

      if (symbol.getName() === 'SharedAggregateRoot') {
        return true;
      }

      for (const declaration of symbol.getDeclarations() ?? []) {
        if (ts.isClassDeclaration(declaration) || ts.isClassExpression(declaration)) {
          for (const heritage of declaration.heritageClauses ?? []) {
            if (heritage.token !== ts.SyntaxKind.ExtendsKeyword) {
              continue;
            }

            for (const baseType of heritage.types) {
              const baseSymbol = checker.getTypeAtLocation(baseType.expression).getSymbol();

              if (baseSymbol && symbolExtendsSharedAggregateRoot(baseSymbol, seen)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    }

    function typeExtendsSharedAggregateRoot(type, seen = new Set()) {
      if (!type || seen.has(type)) {
        return false;
      }

      seen.add(type);

      if (type.isUnion() || type.isIntersection()) {
        return type.types.some((member) => typeExtendsSharedAggregateRoot(member, seen));
      }

      const symbol = type.getSymbol() ?? type.aliasSymbol;

      if (symbol && symbolExtendsSharedAggregateRoot(symbol)) {
        return true;
      }

      if ('getBaseTypes' in type) {
        const baseTypes = type.getBaseTypes?.() ?? [];

        if (baseTypes.some((base) => typeExtendsSharedAggregateRoot(base, seen))) {
          return true;
        }
      }

      const apparent = checker.getApparentType(type);

      if (apparent !== type) {
        return typeExtendsSharedAggregateRoot(apparent, seen);
      }

      return false;
    }

    function reportIfEntity(node, object, property) {
      if (object.type === AST_NODE_TYPES.ThisExpression) {
        return;
      }

      const tsNode = services.esTreeNodeToTSNodeMap.get(object);
      const type = checker.getTypeAtLocation(tsNode);

      if (!typeExtendsSharedAggregateRoot(type)) {
        return;
      }

      const propertyName = getDisplayName(property, sourceCode);
      const entityName = getDisplayName(object, sourceCode);

      context.report({
        node,
        messageId: 'noDirectMutation',
        data: {
          entity: entityName,
          property: propertyName,
        },
      });
    }

    return {
      AssignmentExpression(node) {
        if (node.left.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        reportIfEntity(node, node.left.object, node.left.property);
      },
      UpdateExpression(node) {
        if (node.argument.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        reportIfEntity(node, node.argument.object, node.argument.property);
      },
    };
  },
});
