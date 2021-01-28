// @flow

import type {Type} from '../types.js';
import type {Expression} from '../expression.js';
import type ParsingContext from '../parsing_context.js';
import type EvaluationContext  from '../evaluation_context.js';

class Var implements Expression {
    type: Type;
    name: string;
    boundExpression: Expression;

    constructor(name: string, boundExpression: Expression) {
        this.type = boundExpression.type;
        this.name = name;
        this.boundExpression = boundExpression;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length !== 2 || typeof args[1] !== 'string')
            return context.error(`'var' expression requires exactly one string literal argument.`);

        const name = args[1];
        if (!context.scope.has(name)) {
            return context.error(`Unknown variable "${name}". Make sure "${name}" has been bound in an enclosing "let" expression before using it.`, 1);
        }

        return new Var(name, context.scope.get(name));
    }

    evaluate(ctx: EvaluationContext) {
        return this.boundExpression.evaluate(ctx);
    }

    eachChild() {}

    outputDefined() {
        return false;
    }

    serialize() {
        return ["var", this.name];
    }
}

export default Var;
