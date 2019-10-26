// @flow

import {ValueType, BooleanType, toString} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';
import type {Value} from '../values';

function isComparableType(type: Type) {
    return type.kind === 'boolean' ||
           type.kind === 'string' ||
           type.kind === 'number' ||
           type.kind === 'null' ||
           type.kind === 'value';
}

function isComparableRuntimeValue(needle: boolean | string | number | null) {
    return typeof needle === 'boolean' ||
           typeof needle === 'string' ||
           typeof needle === 'number';
}

function isSearchableRuntimeValue(haystack: Array<Value> | string) {
    return Array.isArray(haystack) ||
           typeof haystack === 'string';
}

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
        if (args.length !== 3) {
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);
        }

        const needle = context.parse(args[1], 1, ValueType);

        const haystack = context.parse(args[2], 2, ValueType);

        if (!needle || !haystack) return null;

        if (!isComparableType(needle.type)) {
            return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${toString(needle.type)} instead`);
        }

        return new In(needle, haystack);
    }

    evaluate(ctx: EvaluationContext) {
        const needle = (this.needle.evaluate(ctx): any);
        const haystack = (this.haystack.evaluate(ctx): any);

        if (!needle || !haystack) return false;

        if (!isComparableRuntimeValue(needle)) {
            throw new RuntimeError(`Expected first argument to be of type boolean, string or number, but found ${toString(typeOf(needle))} instead.`);
        }

        if (!isSearchableRuntimeValue(haystack)) {
            throw new RuntimeError(`Expected second argument to be of type array or string, but found ${toString(typeOf(haystack))} instead.`);
        }

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
