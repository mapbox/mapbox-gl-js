// @flow

import {ValueType, NumberType, StringType, array, toString, isValidType, isValidNativeType} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class Slice implements Expression {
    type: Type;
    input: Expression;
    beginIndex: Expression;
    endIndex: ?Expression;

    constructor(type: Type, input: Expression, beginIndex: Expression, endIndex?: Expression) {
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

        if (!input || !beginIndex) return null;

        if (!isValidType(input.type, [array(ValueType), StringType, ValueType])) {
            return context.error(`Expected first argument to be of type array or string, but found ${toString(input.type)} instead`);
        }

        if (args.length === 4) {
            const endIndex = context.parse(args[3], 3, NumberType);
            if (!endIndex) return null;
            return new Slice(input.type, input, beginIndex, endIndex);
        } else {
            return new Slice(input.type, input, beginIndex);
        }
    }

    evaluate(ctx: EvaluationContext) {
        const input = (this.input.evaluate(ctx): any);
        const beginIndex = (this.beginIndex.evaluate(ctx): number);

        if (!isValidNativeType(input, ['string', 'array'])) {
            throw new RuntimeError(`Expected first argument to be of type array or string, but found ${toString(typeOf(input))} instead.`);
        }

        if (this.endIndex) {
            const endIndex = (this.endIndex.evaluate(ctx): number);
            return input.slice(beginIndex, endIndex);
        }

        return input.slice(beginIndex);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.input);
        fn(this.beginIndex);
        if (this.endIndex) {
            fn(this.endIndex);
        }
    }

    outputDefined() {
        return false;
    }

    serialize() {
        if (this.endIndex != null && this.endIndex !== undefined) {
            const endIndex = this.endIndex.serialize();
            return ["slice", this.input.serialize(), this.beginIndex.serialize(), endIndex];
        }
        return ["slice", this.input.serialize(), this.beginIndex.serialize()];
    }
}

export default Slice;
