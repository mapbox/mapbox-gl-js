// @flow

import Scope from './scope';

import { checkSubtype } from './types';
import ParsingError from './parsing_error';
import Literal from './definitions/literal';
import Assertion from './definitions/assertion';
import ArrayAssertion from './definitions/array';
import Coercion from './definitions/coercion';

import type {Expression, ExpressionRegistry} from './expression';
import type {Type} from './types';

/**
 * State associated parsing at a given point in an expression tree.
 * @private
 */
class ParsingContext {
    registry: ExpressionRegistry;
    path: Array<number>;
    key: string;
    scope: Scope;
    errors: Array<ParsingError>;

    // The expected type of this expression. Provided only to allow Expression
    // implementations to infer argument types: Expression#parse() need not
    // check that the output type of the parsed expression matches
    // `expectedType`.
    expectedType: ?Type;

    constructor(
        registry: ExpressionRegistry,
        path: Array<number> = [],
        expectedType: ?Type,
        scope: Scope = new Scope(),
        errors: Array<ParsingError> = []
    ) {
        this.registry = registry;
        this.path = path;
        this.key = path.map(part => `[${part}]`).join('');
        this.scope = scope;
        this.errors = errors;
        this.expectedType = expectedType;
    }

    /**
     * @param expr the JSON expression to parse
     * @param index the optional argument index if this expression is an argument of a parent expression that's being parsed
     * @param options
     * @param options.omitTypeAnnotations set true to omit inferred type annotations.  Caller beware: with this option set, the parsed expression's type will NOT satisfy `expectedType` if it would normally be wrapped in an inferred annotation.
     * @private
     */
    parse(
        expr: mixed,
        index?: number,
        expectedType?: ?Type,
        bindings?: Array<[string, Expression]>,
        options: {omitTypeAnnotations?: boolean} = {}
    ): ?Expression {
        let context = this;
        if (index) {
            context = context.concat(index, expectedType, bindings);
        }

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

            const Expr = context.registry[op];
            if (Expr) {
                let parsed = Expr.parse(expr, context);
                if (!parsed) return null;

                if (context.expectedType) {
                    const expected = context.expectedType;
                    const actual = parsed.type;

                    // When we expect a number, string, boolean, or array but
                    // have a Value, we can wrap it in a refining assertion.
                    // When we expect a Color but have a String or Value, we
                    // can wrap it in "to-color" coercion.
                    // Otherwise, we do static type-checking.
                    if ((expected.kind === 'string' || expected.kind === 'number' || expected.kind === 'boolean' || expected.kind === 'object') && actual.kind === 'value') {
                        if (!options.omitTypeAnnotations) {
                            parsed = new Assertion(expected, [parsed]);
                        }
                    } else if (expected.kind === 'array' && actual.kind === 'value') {
                        if (!options.omitTypeAnnotations) {
                            parsed = new ArrayAssertion(expected, parsed);
                        }
                    } else if (expected.kind === 'color' && (actual.kind === 'value' || actual.kind === 'string')) {
                        if (!options.omitTypeAnnotations) {
                            parsed = new Coercion(expected, [parsed]);
                        }
                    } else if (context.checkSubtype(context.expectedType, parsed.type)) {
                        return null;
                    }
                }

                // If an expression's arguments are all literals, we can evaluate
                // it immediately and replace it with a literal value in the
                // parsed/compiled result.
                if (!(parsed instanceof Literal) && isConstant(parsed)) {
                    const ec = new (require('./evaluation_context'))();
                    try {
                        parsed = new Literal(parsed.type, parsed.evaluate(ec));
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

    /**
     * Returns a copy of this context suitable for parsing the subexpression at
     * index `index`, optionally appending to 'let' binding map.
     *
     * Note that `errors` property, intended for collecting errors while
     * parsing, is copied by reference rather than cloned.
     * @private
     */
    concat(index: number, expectedType?: ?Type, bindings?: Array<[string, Expression]>) {
        const path = typeof index === 'number' ? this.path.concat(index) : this.path;
        const scope = bindings ? this.scope.concat(bindings) : this.scope;
        return new ParsingContext(
            this.registry,
            path,
            expectedType || null,
            scope,
            this.errors
        );
    }

    /**
     * Push a parsing (or type checking) error into the `this.errors`
     * @param error The message
     * @param keys Optionally specify the source of the error at a child
     * of the current expression at `this.key`.
     * @private
     */
    error(error: string, ...keys: Array<number>) {
        const key = `${this.key}${keys.map(k => `[${k}]`).join('')}`;
        this.errors.push(new ParsingError(key, error));
    }

    /**
     * Returns null if `t` is a subtype of `expected`; otherwise returns an
     * error message and also pushes it to `this.errors`.
     */
    checkSubtype(expected: Type, t: Type): ?string {
        const error = checkSubtype(expected, t);
        if (error) this.error(error);
        return error;
    }
}

export default ParsingContext;

function isConstant(expression: Expression) {
    // requires within function body to workaround circular dependency
    const {CompoundExpression} = require('./compound_expression');
    const {isGlobalPropertyConstant, isFeatureConstant} = require('./is_constant');
    const Var = require('./definitions/var');

    if (expression instanceof Var) {
        return false;
    } else if (expression instanceof CompoundExpression && expression.name === 'error') {
        return false;
    }

    let literalArgs = true;
    expression.eachChild(arg => {
        if (!(arg instanceof Literal)) { literalArgs = false; }
    });
    if (!literalArgs) {
        return false;
    }

    return isFeatureConstant(expression) &&
        isGlobalPropertyConstant(expression, ['zoom', 'heatmap-density']);
}
