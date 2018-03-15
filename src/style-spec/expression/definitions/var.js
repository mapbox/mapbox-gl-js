// @flow

import type { Type } from '../types';
import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext  from '../evaluation_context';

class Var implements Expression {
    type: Type;
    name: string;

    constructor(name: string, type: Type) {
        this.type = type;
        this.name = name;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 2 || typeof args[1] !== 'string')
            return context.error(`'var' expression requires exactly one string literal argument.`);

        const name = args[1];
        if (!context.scope.has(name)) {
            return context.error(`Unknown variable "${name}". Make sure "${name}" has been bound in an enclosing "let" expression before using it.`, 1);
        }

        return new Var(name, context.scope.get(name).type);
    }

    evaluate(ctx: EvaluationContext) {
        return ctx.scope.get(this.name).evaluate(ctx);
    }

    eachChild() {}

    possibleOutputs() {
        return [undefined];
    }
}

export default Var;
