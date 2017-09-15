// @flow

const parseExpression = require('../parse_expression');
import type { Type } from '../types';
import type { Expression, ParsingContext, CompilationContext }  from '../expression';

class Let implements Expression {
    key: string;
    type: Type;
    bindings: Array<[string, Expression]>;
    result: Expression;

    constructor(key: string, bindings: Array<[string, Expression]>, result: Expression) {
        this.key = key;
        this.type = result.type;
        this.bindings = [].concat(bindings);
        this.result = result;
    }

    compile(ctx: CompilationContext) {
        ctx.pushScope(this.bindings);
        const result = this.result.compile(ctx);
        ctx.popScope();
        return result;
    }

    serialize() {
        const serialized = ['let'];
        for (const [name, expression] of this.bindings) {
            serialized.push(name, expression.serialize());
        }
        serialized.push(this.result.serialize());
        return serialized;
    }

    eachChild(fn: (Expression) => void) {
        for (const binding of this.bindings) {
            fn(binding[1]);
        }
        fn(this.result);
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 4)
            return context.error(`Expected at least 3 arguments, but found ${args.length - 1} instead.`);

        const bindings: Array<[string, Expression]> = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            const name = args[i];

            if (typeof name !== 'string') {
                return context.error(`Expected string, but found ${typeof name} instead.`, i);
            }

            if (/[^a-zA-Z0-9_]/.test(name)) {
                return context.error(`Variable names must contain only alphanumeric characters or '_'.`, i);
            }

            const value = parseExpression(args[i + 1], context.concat(i + 1));
            if (!value) return null;

            bindings.push([name, value]);
        }

        const resultContext = context.concat(args.length - 1, undefined, bindings);
        const result = parseExpression(args[args.length - 1], resultContext);
        if (!result) return null;

        return new Let(context.key, bindings, result);
    }
}

module.exports = Let;
