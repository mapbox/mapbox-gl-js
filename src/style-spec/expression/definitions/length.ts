import {NumberType, toString} from '../types';
import {typeOf} from '../values';
import RuntimeError from '../runtime_error';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class Length implements Expression {
    type: Type;
    input: Expression;

    constructor(input: Expression) {
        this.type = NumberType;
        this.input = input;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Length | null | undefined {
        if (args.length !== 2)
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Length'.
            return context.error(`Expected 1 argument, but found ${args.length - 1} instead.`);

        const input = context.parse(args[1], 1);
        if (!input) return null;

        if (input.type.kind !== 'array' && input.type.kind !== 'string' && input.type.kind !== 'value')
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Length'.
            return context.error(`Expected argument of type string or array, but found ${toString(input.type)} instead.`);

        return new Length(input);
    }

    evaluate(ctx: EvaluationContext): number {
        const input = this.input.evaluate(ctx);
        if (typeof input === 'string') {
            return input.length;
        } else if (Array.isArray(input)) {
            return input.length;
        } else {
            throw new RuntimeError(`Expected value to be of type string or array, but found ${toString(typeOf(input))} instead.`);
        }
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.input);
    }

    outputDefined(): boolean {
        return false;
    }

    serialize(): SerializedExpression {
        const serialized = ["length"];
        // @ts-expect-error - TS2345 - Argument of type 'SerializedExpression' is not assignable to parameter of type 'string'.
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Length;
