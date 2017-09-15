// @flow

const Literal = require('./definitions/literal');
const {CompilationContext} = require('./expression');
import type {ParsingContext, Expression} from './expression';

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
                // When we expect a number, string, or boolean but have a
                // Value, wrap it in a refining assertion, and when we expect
                // a Color but have a String or Value, wrap it in "to-color"
                // coercion.
                const canAssert = expected.kind === 'String' ||
                    expected.kind === 'Number' ||
                    expected.kind === 'Boolean';

                if (canAssert && actual.kind === 'Value') {
                    const Assertion = require('./definitions/assertion');
                    parsed = new Assertion(parsed.key, expected, [parsed]);
                } else if (expected.kind === 'Color' && (actual.kind === 'Value' || actual.kind === 'String')) {
                    const Coercion = require('./definitions/coercion');
                    parsed = new Coercion(parsed.key, expected, [parsed]);
                }

                if (context.checkSubtype(expected, parsed.type)) {
                    return null;
                }
            }

            // If an expression's arguments are all literals, we can evaluate
            // it immediately and replace it with a literal value in the
            // parsed/compiled result.
            if (isConstant(parsed)) {
                const cc = new CompilationContext();
                const ec = require('./evaluation_context')();
                const compiled = cc.compileToFunction(parsed, ec);
                try {
                    const value = compiled({}, {});
                    parsed = new Literal(parsed.key, parsed.type, value);
                } catch (e) {
                    context.error(e.message);
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

const nonConstantExpressions = [ 'error', 'get', 'has', 'properties', 'id', 'geometry-type', 'zoom' ];
function isConstant(expression: Expression) {
    const {CompoundExpression} = require('./compound_expression');
    const Var = require('./definitions/var');
    if (expression instanceof CompoundExpression && nonConstantExpressions.indexOf(expression.name) >= 0) {
        return false;
    } else if (expression instanceof Var) {
        return false;
    }

    let constant = true;
    expression.eachChild(arg => {
        constant = constant && (arg instanceof Literal);
    });
    return constant;
}

module.exports = parseExpression;
