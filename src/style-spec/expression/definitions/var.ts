import type {Type} from '../types';
import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext  from '../evaluation_context';

class Var implements Expression {
    type: Type;
    name: string;
    boundExpression: Expression;

    constructor(name: string, boundExpression: Expression) {
        this.type = boundExpression.type;
        this.name = name;
        this.boundExpression = boundExpression;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): void | Var {
        if (args.length !== 2 || typeof args[1] !== 'string')
            return context.error(`'var' expression requires exactly one string literal argument.`);

        const name = args[1];
        if (!context.scope.has(name)) {
            return context.error(`Unknown variable "${name}". Make sure "${name}" has been bound in an enclosing "let" expression before using it.`, 1);
        }

        return new Var(name, context.scope.get(name));
    }

    evaluate(ctx: EvaluationContext): any {
        return this.boundExpression.evaluate(ctx);
    }

    eachChild() {}

    outputDefined(): boolean {
        return false;
    }

    serialize(): Array<string> {
        return ["var", this.name];
    }
}

export default Var;
