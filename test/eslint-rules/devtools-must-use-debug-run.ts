import {ESLintUtils, AST_NODE_TYPES} from '@typescript-eslint/utils';

import type {TSESTree} from '@typescript-eslint/utils';

// eslint-disable-next-line new-cap
const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/mapbox/mapbox-gl-js/tree/main/test/eslint-rules/${name}`
);

/**
 * Checks whether a given node is inside a Debug.run() call expression.
 */
function isInsideDebugRun(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node.parent;
    while (current) {
        if (
            current.type === AST_NODE_TYPES.CallExpression &&
            current.callee.type === AST_NODE_TYPES.MemberExpression &&
            current.callee.object.type === AST_NODE_TYPES.Identifier &&
            current.callee.object.name === 'Debug' &&
            current.callee.property.type === AST_NODE_TYPES.Identifier &&
            current.callee.property.name === 'run'
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

export default createRule({
    name: 'devtools-must-use-debug-run',
    defaultOptions: [],
    meta: {
        type: 'problem',
        docs: {
            description: 'Require _devtools property access to be wrapped in Debug.run() for production stripping'
        },
        messages: {
            mustUseDebugRun:
                'Access to _devtools must be wrapped in Debug.run() to ensure production stripping.',
        },
        schema: [],
    },
    create(context) {
        return {
            MemberExpression(node) {
                if (
                    node.property.type === AST_NODE_TYPES.Identifier &&
                    node.property.name === '_devtools' &&
                    !isInsideDebugRun(node)
                ) {
                    context.report({
                        node,
                        messageId: 'mustUseDebugRun',
                    });
                }
            },
        };
    },
});
