// @flow

import {NumberType, toString} from '../types.js';

import {typeOf} from '../values.js';
import RuntimeError from '../runtime_error.js';

import type {Expression, SerializedExpression} from '../expression.js';
import type ParsingContext from '../parsing_context.js';
import type EvaluationContext from '../evaluation_context.js';
import type {Type} from '../types.js';

class Length implements Expression {
    type: Type;
    input: Expression;

    constructor(input: Expression) {
        this.type = NumberType;
        this.input = input;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Length {
        if (args.length !== 2)
            return context.error(`Expected 1 argument, but found ${args.length - 1} instead.`);

        const input = context.parse(args[1], 1);
        if (!input) return null;

        if (input.type.kind !== 'array' && input.type.kind !== 'string' && input.type.kind !== 'value')
            return context.error(`Expected argument of type string or array, but found ${toString(input.type)} instead.`);

        return new Length(input);
    }

    evaluate(ctx: EvaluationContext): any | number {
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
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Length;
