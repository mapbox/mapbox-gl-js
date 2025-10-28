import {ESLintUtils, AST_NODE_TYPES} from '@typescript-eslint/utils';
import {
    getTypeName,
    isTypeAnyType,
    isTypeUnknownType,
    isTypeReferenceType,
    isSymbolFromDefaultLibrary
} from '@typescript-eslint/type-utils';

import type {Type, TypeChecker, Program} from 'typescript';

// eslint-disable-next-line new-cap
const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/mapbox/mapbox-gl-js/tree/main/test/eslint-rules/${name}`
);

const COLLECTION_TYPES = new Set(['Map', 'Set', 'WeakMap', 'WeakSet']);

const ALTERNATIVES: Record<string, Record<string, string>> = {
    'Object.keys': {
        'Map': 'Array.from(map.keys())',
        'WeakMap': 'Array.from(map.keys())',
        'Set': 'Array.from(set.values())',
        'WeakSet': 'Array.from(set.values())'
    },
    'Object.values': {
        'Map': 'Array.from(map.values())',
        'WeakMap': 'Array.from(map.values())',
        'Set': 'Array.from(set.values())',
        'WeakSet': 'Array.from(set.values())'
    },
    'Object.entries': {
        'Map': 'Array.from(map.entries())',
        'WeakMap': 'Array.from(map.entries())',
        'Set': 'Array.from(set.entries())',
        'WeakSet': 'Array.from(set.entries())'
    }
};

/**
 * Check if the given type is a Map, Set, WeakMap, or WeakSet instance.
 */
function getCollectionType(type: Type, checker: TypeChecker, program: Program): string | undefined {
    const nonNullableType = checker.getNonNullableType(type);
    const typeName = getTypeName(checker, nonNullableType);

    if (!COLLECTION_TYPES.has(typeName)) {
        return undefined;
    }

    // For direct types, check if the symbol is from the standard library
    const symbol = nonNullableType.getSymbol();
    if (symbol && isSymbolFromDefaultLibrary(program, symbol)) {
        return typeName;
    }

    // Handle generic instantiations like Map<string, number>
    // TypeReference types have a 'target' property pointing to the generic type
    if (isTypeReferenceType(nonNullableType)) {
        const targetSymbol = nonNullableType.target.getSymbol();
        if (targetSymbol && targetSymbol.getName() === typeName && isSymbolFromDefaultLibrary(program, targetSymbol)) {
            return typeName;
        }
    }

    return undefined;
}

export default createRule({
    name: 'no-object-methods-on-collections',
    defaultOptions: [],
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow using Object.keys, Object.values, and Object.entries on Map and Set instances'
        },
        messages: {
            noObjectMethodsOnCollections:
                'Using {{method}}() on a {{type}} always returns an empty array. Use {{alternative}} instead.',
        },
        schema: [],
    },
    create(context) {
        const parserServices = ESLintUtils.getParserServices(context);
        const program = parserServices.program;
        const checker = program.getTypeChecker();

        return {
            CallExpression(node) {
                // Is it Object.keys/values/entries() call?
                if (
                    node.callee.type !== AST_NODE_TYPES.MemberExpression ||
                    node.callee.object.type !== AST_NODE_TYPES.Identifier ||
                    node.callee.object.name !== 'Object' ||
                    node.callee.property.type !== AST_NODE_TYPES.Identifier ||
                    !['keys', 'values', 'entries'].includes(node.callee.property.name) ||
                    node.arguments.length !== 1
                ) {
                    return;
                }

                // Get the type of the argument
                const argument = node.arguments[0];
                const tsNode = parserServices.esTreeNodeToTSNodeMap.get(argument);
                const type = checker.getTypeAtLocation(tsNode);

                // Skip any and unknown types to avoid false positives
                if (isTypeAnyType(type) || isTypeUnknownType(type)) {
                    return;
                }

                // Is the argument a collection type?
                const collectionType = getCollectionType(type, checker, program);
                if (!collectionType) {
                    return;
                }

                const methodName = `Object.${node.callee.property.name}`;
                const methodAlternatives = ALTERNATIVES[methodName];
                const alternative = methodAlternatives[collectionType] || `the ${collectionType}'s own methods`;

                context.report({
                    node,
                    messageId: 'noObjectMethodsOnCollections',
                    data: {
                        method: methodName,
                        type: collectionType,
                        alternative,
                    },
                });
            },
        };
    },
});
