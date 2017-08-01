// @flow

const { parseExpression, Reference } = require('./expression');
const { match } = require('./types');
const assert = require('assert');

import type {
    Expression,
    ParsingContext,
    Scope
}  from './expression';
import type { ExpressionName } from './expression_name';
import type { Type, TypeError } from './types';

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

    typecheck(scope: Scope, errors: Array<TypeError>) {
        // Check if the expected type matches the expression's output type
        let signatureErrors = [];
        for (const params of this.constructor.signatures()) {
            signatureErrors = [];
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
                signatureErrors.push({
                    key: this.key,
                    error: `Expected ${expandedParams.length} arguments, but found ${argValues.length} instead.`
                });
                continue;
            }

            // Iterate through arguments to:
            //  - match parameter type vs argument type, checking argument's result type only (don't recursively typecheck subexpressions at this stage)
            //  - collect typename mappings when ^ succeeds or type errors when it fails
            for (let i = 0; i < argValues.length; i++) {
                let arg = argValues[i];
                if (arg instanceof Reference) {
                    arg = scope.get(arg.name);
                }
                match(expandedParams[i], arg.type, arg.key, signatureErrors);
            }

            if (signatureErrors.length) continue;

            // recursively type check argument subexpressions
            const resolvedParams = [];
            const checkedArgs = [];
            for (let i = 0; i < expandedParams.length; i++) {
                const expected = expandedParams[i];
                const arg = argValues[i];
                const checked = arg.typecheck(scope, signatureErrors);
                if (!checked) continue;
                const error = match(expected, checked.type, arg.key, signatureErrors);
                if (error) {
                    signatureErrors.push({key: checked.key, error});
                }
                if (signatureErrors.length === 0) {
                    resolvedParams.push(expected);
                    checkedArgs.push(checked);
                }
            }

            if (signatureErrors.length === 0) {
                return this.applyType(this.type, checkedArgs);
            }
        }

        assert(signatureErrors.length > 0);
        errors.push.apply(errors, signatureErrors);
        return null;
    }

    compile(): string {
        const compiledArgs: Array<string> = [];

        const args = this.args;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const compiledArg = arg.compile();
            compiledArgs.push(`(${compiledArg})`);
        }

        return this.compileFromArgs(compiledArgs);
    }

    compileFromArgs(_: Array<string>): string {
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
