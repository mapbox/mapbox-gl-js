// @flow

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
    lambda,
    array,
    variant,
    nargs,
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
    } else {
        // e is a lambda expression, so check its result type against the
        // expected type and recursively typecheck its arguments

        const typenames: { [string]: Type } = {};

        if (expected.kind !== 'lambda') {
            // if the expected type is not a lambda, then check if it matches
            // the expression's output type, and then proceed with type checking
            // the arguments using e.type, which comes from the expression
            // definition.
            const error = match(expected, e.type.result, {}, typenames);
            if (error) return { result: 'error', errors: [{ key: e.key, error }] };
            expected = e.type;
        } else {
            const error = match(expected.result, e.type.result, typenames);
            if (error) return { result: 'error', errors: [{ key: e.key, error }] };
        }

        // "Unroll" NArgs if present in the parameter list:
        // argCount = nargType.type.length * n + nonNargParameterCount
        // where n is the number of times the NArgs sequence must be
        // repeated.
        const argValues = e.args;
        const expandedParams = [];
        const errors = [];
        for (const param of expected.params) {
            if (param.kind === 'nargs') {
                let count = (argValues.length - (expected.params.length - 1)) / param.types.length;
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
            return {
                result: 'error',
                errors: [{
                    key: e.key,
                    error: `Expected ${expandedParams.length} arguments, but found ${argValues.length} instead.`
                }]
            };
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

        const resultType = resolveTypenamesIfPossible(expected.result, typenames);

        if (isGeneric(resultType)) return {
            result: 'error',
            errors: [{key: e.key, error: `Could not resolve ${e.type.result.name}.  This expression must be wrapped in a type conversion, e.g. ["string", ${stringifyExpression(e)}].`}]
        };

        // If we already have errors, return early so we don't get duplicates when
        // we typecheck against the resolved argument types
        if (errors.length) return { result: 'error', errors };

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

        // handle 'match' expression input values
        // let matchInputs;
        // if (e.matchInputs) {
        //     matchInputs = [];
        //     const inputType = resolvedParams[0];
        //     for (const inputGroup of e.matchInputs) {
        //         const checkedGroup = [];
        //         for (const inputValue of inputGroup) {
        //             const result = typeCheckExpression(inputType, inputValue);
        //             if (result.errors) {
        //                 errors.push.apply(errors, result.errors);
        //             } else {
        //                 checkedGroup.push(((result: any): TypedLiteralExpression));
        //             }
        //         }
        //         matchInputs.push(checkedGroup);
        //     }
        // }

        if (errors.length > 0) return { result: 'error', errors };

        return {
            result: 'success',
            expression: e.applyType(lambda(resultType, ...resolvedParams), checkedArgs)
        };
    }
}

/**
 * Returns null if the type matches, or an error message if not.
 *
 * Also populate the given typenames maps: `expectedTypenames` maps typenames
 * from the scope of `expected` to Types, and `tTypenames` does the same for
 * typenames from t's typename scope.
 *
 * @private
 */
function match(expected: Type, t: Type, expectedTypenames: { [string]: Type } = {}, tTypenames: { [string]: Type } = {}) {
    if (t.kind === 'lambda') t = t.result;
    const errorMessage = `Expected ${expected.name} but found ${t.name} instead.`;

    if (expected.kind === 'typename') {
        if (!expectedTypenames[expected.typename] && !isGeneric(t) && t !== NullType) {
            expectedTypenames[expected.typename] = t;
        }
        return null;
    }

    if (t.kind === 'typename' && !isGeneric(expected)) {
        if (!tTypenames[t.typename] && t !== NullType) {
            tTypenames[t.typename] = expected;
        }
        t = expected;
    }

    // a `null` literal is allowed anywhere.
    if (t.name === 'Null') return null;

    if (expected.kind === 'primitive') {
        if (t === expected) return null;
        else return errorMessage;
    } else if (expected.kind === 'array') {
        if (t.kind === 'array') {
            const error = match(expected.itemType, t.itemType, expectedTypenames, tTypenames);
            if (error) return `${errorMessage} (${error})`;
            else if (typeof expected.N === 'number' && expected.N !== t.N) return errorMessage;
            else return null;
        } else {
            return errorMessage;
        }
    } else if (expected.kind === 'variant') {
        if (t === expected) return null;

        for (const memberType of expected.members) {
            const mExpectedTypenames = extend({}, expectedTypenames);
            const mTTypenames = extend({}, tTypenames);
            const error = match(memberType, t, mExpectedTypenames, mTTypenames);
            if (!error) {
                extend(expectedTypenames, mExpectedTypenames);
                extend(tTypenames, mTTypenames);
                return null;
            }
        }

        // If t itself is a variant, then 'expected' must match each of its
        // member types in order for this to be a match.
        if (t.kind === 'variant') return t.members.some(m => match(expected, m, expectedTypenames, tTypenames)) ? errorMessage : null;

        return errorMessage;
    }

    throw new Error(`${expected.name} is not a valid output type.`);
}

function stringifyExpression(e: Expression, withTypes: boolean = false) :string {
    return JSON.stringify(e.serialize(withTypes));
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
    if (type.kind === 'typename') return typenames[type.typename] || type;

    const resolve = (t) => resolveTypenamesIfPossible(t, typenames, stack.concat(type));
    if (type.kind === 'array') return array(resolve(type.itemType), type.N);
    if (type.kind === 'variant') return variant(...type.members.map(resolve));
    if (type.kind === 'nargs') return nargs(type.N, ...type.types.map(resolve));
    if (type.kind === 'lambda') return lambda(resolve(type.result), ...type.params.map(resolve));

    assert(false, `Unsupported type ${type.kind}`);
    return type;
}

