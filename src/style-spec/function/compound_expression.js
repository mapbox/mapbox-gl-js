// @flow

const { parseExpression, Reference } = require('./expression');
const { array, isGeneric, match } = require('./types');
const assert = require('assert');
const extend = require('../util/extend');

import type { Expression, CompileError, ParsingContext, Scope }  from './expression';
import type { ExpressionName } from './expression_name';
import type { Type } from './types';

export type NArgs = { kind: 'nargs', types: Array<Type>, N: number };
export type Signature = Array<Type | NArgs>;

class CompoundExpression implements Expression {
    key: string;
    type: Type;
    args: Array<Expression>;

    constructor(key: *, type: Type, args: Array<Expression>) {
        this.key = key;
        this.type = type;
        this.args = args;
    }

    applyType(type: Type, args: Array<Expression>): Expression {
        return new this.constructor(this.key, type, args);
    }

    typecheck(expected: Type, scope: Scope) {
        // Check if the expected type matches the expression's output type;
        // If expression's output type is generic, pick up a typename binding
        // to a concrete expected type if possible
        const initialTypenames: { [string]: Type } = {};
        const error = match(expected, this.type, initialTypenames, 'actual');
        if (error) return { result: 'error', errors: [{ key: this.key, error }] };
        expected = this.type;

        let errors = [];
        for (const params of this.constructor.signatures()) {
            errors = [];
            const typenames: { [string]: Type } = extend({}, initialTypenames);
            // "Unroll" NArgs if present in the parameter list:
            // argCount = nargType.type.length * n + nonNargParameterCount
            // where n is the number of times the NArgs sequence must be
            // repeated.
            const argValues = this.args;
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
                    key: this.key,
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
                    key: this.key,
                    error: `Could not resolve ${this.type.name}.  This expression must be wrapped in a type conversion, e.g. ["string", ${stringifyExpression(this)}].`
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
                const checked = arg.typecheck(expected, scope);
                if (checked.result === 'error') {
                    errors.push.apply(errors, checked.errors);
                } else if (errors.length === 0) {
                    resolvedParams.push(expected);
                    checkedArgs.push(checked.expression);
                }
            }

            if (errors.length === 0) return {
                result: 'success',
                expression: this.applyType(resultType, checkedArgs)
            };
        }

        assert(errors.length > 0);
        return {
            result: 'error',
            errors
        };
    }

    compile(): string | Array<CompileError> {
        const errors: Array<CompileError> = [];
        const compiledArgs: Array<string> = [];

        const args = this.args;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const compiledArg = arg.compile();
            if (Array.isArray(compiledArg)) {
                errors.push.apply(errors, compiledArg);
            } else {
                compiledArgs.push(`(${compiledArg})`);
            }
        }

        if (errors.length > 0) {
            return errors;
        }

        return this.compileFromArgs(compiledArgs);
    }

    compileFromArgs(_: Array<string>): string | Array<CompileError> {
        throw new Error('Unimplemented');
    }

    serialize() {
        const name = this.constructor.opName();
        const args = this.args.map(e => e.serialize());
        return [ name ].concat(args);
    }

    visit(fn: (Expression) => void) {
        fn(this);
        this.args.forEach(a => a.visit(fn));
    }

    // implemented by subclasses
    static opName(): ExpressionName { throw new Error('Unimplemented'); }
    static type(): Type { throw new Error('Unimplemented'); }
    static signatures(): Array<Signature> { throw new Error('Unimplemented'); }

    // default parse; overridden by some subclasses
    static parse(args: Array<mixed>, context: ParsingContext) {
        const op = this.opName();
        const parsedArgs: Array<Expression> = [];
        for (const arg of args) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, op)));
        }

        return new this(context.key, this.type(), parsedArgs);
    }
}

function stringifyExpression(e: Expression) :string {
    return JSON.stringify(e.serialize());
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

function nargs(N: number, ...types: Array<Type>) : NArgs {
    return {
        kind: 'nargs',
        types,
        N
    };
}

module.exports = {
    CompoundExpression,
    nargs
};
