// @flow

const { parseExpression } = require('./expression');

import type { Expression, CompileError, ParsingContext }  from './expression';
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
