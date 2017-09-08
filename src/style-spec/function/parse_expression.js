// @flow

const assert = require('assert');
const {checkSubtype} = require('./types');

import type {Type} from './types';
import type {ParsingContext, Expression} from './expression';
import type {CompoundExpression} from './compound_expression';
import type Assertion from './definitions/assertion';

/**
 * Parse the given JSON expression.
 *
 * @param expectedType If provided, the parsed expression will be checked
 * against this type.  Additionally, `expectedType` will be pssed to
 * Expression#parse(), wherein it may be used to infer child expression types
 *
 * @private
 */
function parseExpression(expr: mixed, context: ParsingContext): ?Expression {
    if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
        expr = ['literal', expr];
    }

    if (Array.isArray(expr)) {
        if (expr.length === 0) {
            return context.error(`Expected an array with at least one element. If you wanted a literal array, use ["literal", []].`);
        }

        const op = expr[0];
        if (typeof op !== 'string') {
            context.error(`Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`, 0);
            return null;
        }

        const Expr = context.definitions[op];
        if (Expr) {
            let parsed = Expr.parse(expr, context);
            if (!parsed) return null;
            const expected = context.expectedType;
            const actual = parsed.type;
            if (expected) {
                // when we expect a specific type but have a Value, wrap it
                // in a refining assertion
                if (expected.kind !== 'Value' && actual.kind === 'Value') {
                    parsed = wrapForType(expected, parsed, context);
                } else if (expected.kind === 'Color' && actual.kind === 'String') {
                    parsed = wrapForType(expected, parsed, context);
                }

                if (context.checkSubtype(expected, parsed.type)) {
                    return null;
                }
            }

            return parsed;
        }

        return context.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
    } else if (typeof expr === 'undefined') {
        return context.error(`'undefined' value invalid. Use null instead.`);
    } else if (typeof expr === 'object') {
        return context.error(`Bare objects invalid. Use ["literal", {...}] instead.`);
    } else {
        return context.error(`Expected an array, but found ${typeof expr} instead.`);
    }
}

function wrapForType(expected: Type, expression: Expression, context: ParsingContext) {
    if (expected.kind === 'Color') {
        // workaround for circular dependency
        const CompoundExpr: Class<CompoundExpression> = (context.definitions['to-color']: any);

        const definition = CompoundExpr.definitions['to-color'];

        assert(
            Array.isArray(definition) && // the wrapper expression has no overloads
            Array.isArray(definition[1]) && // its inputs isn't Varargs
            definition[1].length === 1 && // it takes one parameter
            !checkSubtype(definition[1][0], expression.type) // matching the expression we're trying to wrap
        );

        return new CompoundExpr(expression.key, 'to-color', expected, definition[2], [expression]);
    } else if (
        expected.kind === 'Number' ||
        expected.kind === 'String' ||
        expected.kind === 'Boolean'
    ) {
        // workaround for circular dependency
        const AssertionExpr: Class<Assertion> = (context.definitions['number']: any);
        return new AssertionExpr(expression.key, expected, [expression]);
    } else {
        return expression;
    }
}

module.exports = parseExpression;
