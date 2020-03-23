// @flow

import {ValueType, NumberType, toString} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';
import type {Value} from '../values';

function isSliceableType(type: Type) {
    return type.kind === 'array' ||
           type.kind === 'string' ||
           type.kind === 'value';
}
function isAcceptableInputRuntimeValue(input: Array<Value> | string) {
    return Array.isArray(input) ||
           typeof input === 'string';
}

class Slice implements Expression {
    type: Type;
    input: Expression;
    beginIndex: Expression;
    endIndex: Expression;

    constructor(type: Type, input: Expression, beginIndex: Expression, endIndex: Expression) {
        this.type = type;
        this.input = input;
        this.beginIndex = beginIndex;
        this.endIndex = endIndex;

    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length <= 2 ||  args.length >= 5) {
            return context.error(`Expected 3 or 4 arguments, but found ${args.length - 1} instead.`);
        }

        const input = context.parse(args[1], 1, ValueType);
        const beginIndex = context.parse(args[2], 2, NumberType);
        const endIndex = args.length === 4 ? context.parse(args[3], 3, NumberType) : undefined;

        if (args.length === 3 && (!input || !beginIndex)) return null;
        if (args.length === 4 && (!input || !beginIndex || !endIndex)) return null;

        if (!isSliceableType(input.type)) {
            return context.error(`Expected first argument to be of type array or string, but found ${toString(input.type)} instead`);
        }

        return new Slice(input.type, input, beginIndex, endIndex);
    }

    evaluate(ctx: EvaluationContext) {
        const input = (this.input.evaluate(ctx): Value);
        const beginIndex = (this.beginIndex.evaluate(ctx): number);

        if (!isAcceptableInputRuntimeValue(input)) {
            throw new RuntimeError(`Expected first argument to be of type array or string, but found ${toString(typeOf(input))} instead.`);
        }

        if (this.endIndex !== undefined) {
            const endIndex = (this.endIndex.evaluate(ctx): number);
            return input.slice(beginIndex, endIndex);
        }

        return input.slice(beginIndex);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.input);
        fn(this.beginIndex);
        if (this.endIndex !== undefined) {
            fn(this.endIndex);
        }
    }

    outputDefined() {
        return false;
    }

    serialize() {
        if (this.endIndex === undefined) {
            return ["slice", this.input.serialize(), this.beginIndex.serialize()];
        }
        return ["slice", this.input.serialize(), this.beginIndex.serialize(), this.endIndex.serialize()];
    }
}

export default Slice;
