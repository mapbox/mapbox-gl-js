// @flow

import {array, ValueType, BooleanType} from '../types';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';
import type {Value} from '../values';

class In implements Expression {
    type: Type;
    needle: Expression;
    haystack: Expression;

    constructor(needle: Expression, haystack: Expression) {
        this.type = BooleanType;
        this.needle = needle;
        this.haystack = haystack;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length !== 3)
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);

        const needle = context.parse(args[1], 1, ValueType);
        const haystack = context.parse(args[2], 2, array(ValueType));

        if (!needle || !haystack) return null;

        return new In(needle, haystack);
    }

    evaluate(ctx: EvaluationContext) {
        const needle = (this.needle.evaluate(ctx): any);
        const haystack = ((this.haystack.evaluate(ctx): any): Array<Value>);

        return haystack.indexOf(needle) >= 0;
    }

    eachChild(fn: (Expression) => void) {
        fn(this.needle);
        fn(this.haystack);
    }

    possibleOutputs() {
        return [true, false];
    }

    serialize() {
        return ["in", this.needle.serialize(), this.haystack.serialize()];
    }
}

export default In;
