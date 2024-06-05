import type {Type} from '../types';
import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext  from '../evaluation_context';

class Let implements Expression {
    type: Type;
    bindings: Array<[string, Expression]>;
    result: Expression;

    constructor(bindings: Array<[string, Expression]>, result: Expression) {
        this.type = result.type;
        this.bindings = [].concat(bindings);
        this.result = result;
    }

    evaluate(ctx: EvaluationContext): any {
        return this.result.evaluate(ctx);
    }

    eachChild(fn: (_: Expression) => void) {
        for (const binding of this.bindings) {
            fn(binding[1]);
        }
        fn(this.result);
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Let | null | undefined {
        if (args.length < 4)
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Let'.
            return context.error(`Expected at least 3 arguments, but found ${args.length - 1} instead.`);

        const bindings: Array<[string, Expression]> = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            const name = args[i];

            if (typeof name !== 'string') {
                // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Let'.
                return context.error(`Expected string, but found ${typeof name} instead.`, i);
            }

            if (/[^a-zA-Z0-9_]/.test(name)) {
                // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Let'.
                return context.error(`Variable names must contain only alphanumeric characters or '_'.`, i);
            }

            const value = context.parse(args[i + 1], i + 1);
            if (!value) return null;

            bindings.push([name, value]);
        }

        const result = context.parse(args[args.length - 1], args.length - 1, context.expectedType, bindings);
        if (!result) return null;

        return new Let(bindings, result);
    }

    outputDefined(): boolean {
        return this.result.outputDefined();
    }

    serialize(): SerializedExpression {
        const serialized = ["let"];
        for (const [name, expr] of this.bindings) {
            // @ts-expect-error - TS2345 - Argument of type 'SerializedExpression' is not assignable to parameter of type 'string'.
            serialized.push(name, expr.serialize());
        }
        // @ts-expect-error - TS2345 - Argument of type 'SerializedExpression' is not assignable to parameter of type 'string'.
        serialized.push(this.result.serialize());
        return serialized;
    }
}

export default Let;
