import {array, ValueType, NumberType} from '../types';
import RuntimeError from '../runtime_error';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type, ArrayType} from '../types';
import type {Value} from '../values';

class At implements Expression {
    type: Type;
    index: Expression;
    input: Expression;

    constructor(type: Type, index: Expression, input: Expression) {
        this.type = type;
        this.index = index;
        this.input = input;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): At | null | undefined {
        if (args.length !== 3)
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'At'.
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);

        const index = context.parse(args[1], 1, NumberType);
        const input = context.parse(args[2], 2, array(context.expectedType || ValueType));

        if (!index || !input) return null;

        const t: ArrayType = (input.type as any);
        return new At(t.itemType, index, input);
    }

    evaluate(ctx: EvaluationContext): Value {
        const index = (this.index.evaluate(ctx) as number);
        const array = (this.input.evaluate(ctx) as Array<Value>);

        if (index < 0) {
            throw new RuntimeError(`Array index out of bounds: ${index} < 0.`);
        }

        if (index > array.length - 1) {
            throw new RuntimeError(`Array index out of bounds: ${index} > ${array.length - 1}.`);
        }

        if (index === Math.floor(index)) {
            return array[index];
        }

        // Interpolation logic for non-integer indices
        const lowerIndex = Math.floor(index);
        const upperIndex = Math.ceil(index);

        const lowerValue = array[lowerIndex];
        const upperValue = array[upperIndex];

        if (typeof lowerValue !== 'number' || typeof upperValue !== 'number') {
            throw new RuntimeError(`Cannot interpolate between non-number values at index ${index}.`);
        }

        // Linear interpolation
        const fraction = index - lowerIndex;
        return lowerValue * (1 - fraction) + upperValue * fraction;
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.index);
        fn(this.input);
    }

    outputDefined(): boolean {
        return false;
    }

    serialize(): SerializedExpression {
        return ["at", this.index.serialize(), this.input.serialize()];
    }
}

export default At;
