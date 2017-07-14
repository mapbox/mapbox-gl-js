// @flow

const LambdaExpression = require('./expression').LambdaExpression;

import type { Type } from './types.js';
import type { Expression } from './expression.js';

export type TypeError = {|
    error: string,
    key: string
|}

export type TypecheckResult = {|
    result: 'success',
    expression: Expression
|} | {|
    result: 'error',
    errors: Array<TypeError>
|}

const assert = require('assert');
const extend = require('../util/extend');
const {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    array,
    typename
} = require('./types');
const {
    LetExpression,
    Scope,
    Reference,
    LiteralExpression
} = require('./expression');

module.exports = typeCheckExpression;

// typecheck the given expression and return a new TypedExpression
// tree with all generics resolved
function typeCheckExpression(expected: Type, e: Expression, scope: Scope = new Scope()) : TypecheckResult {
    if (e instanceof LiteralExpression) {
        const error = match(expected, e.type);
        if (error) return { result: 'error', errors: [{ key: e.key, error }] };
        return {result: 'success', expression: e};
    } else if (e instanceof Reference) {
        const referee = scope.get(e.name);
        const error = match(expected, referee.type);
        if (error) return { result: 'error', errors: [{key: e.key, error }] };
        return {
            result: 'success',
            expression: new Reference(e.key, e.name, referee.type)
        };
    } else if (e instanceof LetExpression) {
        const bindings = [];
        for (const [name, value] of e.bindings) {
            const checkedValue = typeCheckExpression(typename('T'), value, scope);
            if (checkedValue.result === 'error') return checkedValue;
            bindings.push([name, checkedValue.expression]);
        }
        const nextScope = scope.concat(bindings);
        const checkedResult = typeCheckExpression(expected, e.result, nextScope);
        if (checkedResult.result === 'error') return checkedResult;
        return {
            result: 'success',
            expression: new LetExpression(e.key, bindings, checkedResult.expression)
        };
    } else if (e instanceof LambdaExpression) {
        // e is a lambda expression, so check its result type against the
        // expected type and recursively typecheck its arguments

        // Check if the expected type matches the expression's output type;
        // If expression's output type is generic, pick up a typename binding
        // to a concrete expected type if possible
        const initialTypenames: { [string]: Type } = {};
        const error = match(expected, e.type, initialTypenames, 'actual');
        if (error) return { result: 'error', errors: [{ key: e.key, error }] };
        expected = e.type;

        let errors = [];
        for (const params of e.constructor.signatures()) {
            errors = [];
            const typenames: { [string]: Type } = extend({}, initialTypenames);
            // "Unroll" NArgs if present in the parameter list:
            // argCount = nargType.type.length * n + nonNargParameterCount
            // where n is the number of times the NArgs sequence must be
            // repeated.
            const argValues = e.args;
            const expandedParams = [];
            for (const param of params) {
                if (param.kind === 'nargs') {
                    let count = (argValues.length - (params.length - 1)) / param.types.length;
                    count = Math.min(param.N, Math.ceil(count));
                    while (count-- > 0) {
                        for (const type of param.types) {
                            expandedParams.push(type);
                        }
                    }
                } else {
                    expandedParams.push(param);
                }
            }

            if (expandedParams.length !== argValues.length) {
                errors.push({
                    key: e.key,
                    error: `Expected ${expandedParams.length} arguments, but found ${argValues.length} instead.`
                });
                continue;
            }

            // Iterate through arguments to:
            //  - match parameter type vs argument type, checking argument's result type only (don't recursively typecheck subexpressions at this stage)
            //  - collect typename mappings when ^ succeeds or type errors when it fails
            for (let i = 0; i < argValues.length; i++) {
                const param = expandedParams[i];
                let arg = argValues[i];
                if (arg instanceof Reference) {
                    arg = scope.get(arg.name);
                }
                const error = match(
                    resolveTypenamesIfPossible(param, typenames),
                    arg.type,
                    typenames
                );
                if (error) errors.push({ key: arg.key, error });
            }

            const resultType = resolveTypenamesIfPossible(expected, typenames);

            if (isGeneric(resultType)) {
                errors.push({
                    key: e.key,
                    error: `Could not resolve ${e.type.name}.  This expression must be wrapped in a type conversion, e.g. ["string", ${stringifyExpression(e)}].`
                });
            }

            // If we already have errors, return early so we don't get duplicates when
            // we typecheck against the resolved argument types
            if (errors.length) continue;

            // resolve typenames and recursively type check argument subexpressions
            const resolvedParams = [];
            const checkedArgs = [];
            for (let i = 0; i < expandedParams.length; i++) {
                const t = expandedParams[i];
                const arg = argValues[i];
                const expected = resolveTypenamesIfPossible(t, typenames);
                const checked = typeCheckExpression(expected, arg, scope);
                if (checked.result === 'error') {
                    errors.push.apply(errors, checked.errors);
                } else if (errors.length === 0) {
                    resolvedParams.push(expected);
                    checkedArgs.push(checked.expression);
                }
            }

            if (errors.length === 0) return {
                result: 'success',
                expression: e.applyType(resultType, checkedArgs)
            };
        }

        assert(errors.length > 0);
        return {
            result: 'error',
            errors
        };
    } else {
        assert(false);
        throw new Error('unexpected expression type');
    }
}

/**
 * Returns null if the type matches, or an error message if not.
 *
 * Also populate the given typenames context when a generic type is successfully
 * matched against a concrete one, with `scope` controlling whether type names
 * from `expected` or `t` are to be bound.
 *
 * @private
 */
function match(
    expected: Type,
    t: Type,
    typenames: { [string]: Type } = {},
    scope: 'expected' | 'actual' = 'expected'
) {
    if (t.kind === 'lambda') t = t.result;
    const errorMessage = `Expected ${expected.name} but found ${t.name} instead.`;

    if (expected.kind === 'typename') {
        if (
            scope === 'expected' &&
            !typenames[expected.typename] &&
            !isGeneric(t) &&
            t !== NullType
        ) {
            typenames[expected.typename] = t;
        }
        return null;
    }

    if (t.kind === 'typename') {
        if (
            scope === 'actual' &&
            !typenames[t.typename] &&
            !isGeneric(expected) &&
            expected !== NullType
        ) {
            typenames[t.typename] = expected;
        }
        return null;
    }

    // a `null` literal is allowed anywhere.
    if (t.name === 'Null') return null;

    if (expected.name === 'Value') {
        if (t === expected) return null;
        const members = [
            NumberType,
            StringType,
            BooleanType,
            ColorType,
            ObjectType,
            array(ValueType)
        ];

        for (const memberType of members) {
            const mTypenames = extend({}, typenames);
            const error = match(memberType, t, mTypenames, scope);
            if (!error) {
                extend(typenames, mTypenames);
                return null;
            }
        }

        return errorMessage;
    } if (expected.kind === 'primitive') {
        if (t === expected) return null;
        else return errorMessage;
    } else if (expected.kind === 'array') {
        if (t.kind === 'array') {
            const error = match(expected.itemType, t.itemType, typenames, scope);
            if (error) return `${errorMessage} (${error})`;
            else if (typeof expected.N === 'number' && expected.N !== t.N) return errorMessage;
            else return null;
        } else {
            return errorMessage;
        }
    }

    throw new Error(`${expected.name} is not a valid output type.`);
}

function stringifyExpression(e: Expression) :string {
    return JSON.stringify(e.serialize());
}

function isGeneric (type, stack = []) {
    if (stack.indexOf(type) >= 0) { return false; }
    if (type.kind === 'typename') {
        return true;
    } else if (type.kind === 'array') {
        return isGeneric(type.itemType, stack.concat(type));
    } else if (type.kind === 'variant') {
        return type.members.some((t) => isGeneric(t, stack.concat(type)));
    } else if (type.kind === 'nargs') {
        return type.types.some((t) => isGeneric(t, stack.concat(type)));
    } else if (type.kind === 'lambda') {
        return isGeneric(type.result) || type.params.some((t) => isGeneric(t, stack.concat(type)));
    }
    return false;
}

function resolveTypenamesIfPossible(type: Type, typenames: {[string]: Type}, stack = []) : Type {
    assert(stack.indexOf(type) < 0, 'resolveTypenamesIfPossible() implementation does not support recursive variants.');
    if (!isGeneric(type)) return type;
    const resolve = (t) => resolveTypenamesIfPossible(t, typenames, stack.concat(type));
    if (type.kind === 'typename') return typenames[type.typename] || type;
    if (type.kind === 'array') return array(resolve(type.itemType), type.N);
    assert(false, `Unsupported type ${type.kind}`);
    return type;
}

