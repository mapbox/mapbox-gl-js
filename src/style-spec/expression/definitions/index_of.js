// @flow

import {ValueType, toString, NumberType} from '../types';
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
           typeof needle === 'number' ||
           needle ===  null;
}

function isSearchableRuntimeValue(haystack: Array<Value> | string) {
    return Array.isArray(haystack) ||
           typeof haystack === 'string';
}

class IndexOf implements Expression {
    type: Type;
    needle: Expression;
    haystack: Expression;
    fromIndex: Expression;

    constructor(needle: Expression, haystack: Expression, fromIndex: Expression) {
        this.type = NumberType;
        this.needle = needle;
        this.haystack = haystack;
        this.fromIndex = fromIndex;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length <= 2 ||  args.length >= 5) {
            return context.error(`Expected 3 or 4 arguments, but found ${args.length - 1} instead.`);
        }

        const needle = context.parse(args[1], 1, ValueType);

        const haystack = context.parse(args[2], 2, ValueType);

        const fromIndex = args.length === 4 ? context.parse(args[3], 3, NumberType) : undefined;

        if (args.length === 3 && (!needle || !haystack)) return null;
        if (args.length === 4 && (!needle || !haystack || !fromIndex)) return null;

        if (!isComparableType(needle.type)) {
            return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${toString(needle.type)} instead`);
        }

        return new IndexOf(needle, haystack, fromIndex);
    }

    evaluate(ctx: EvaluationContext) {
        const needle = (this.needle.evaluate(ctx): any);
        const haystack = (this.haystack.evaluate(ctx): any);

        if (!isComparableRuntimeValue(needle)) {
            throw new RuntimeError(`Expected first argument to be of type boolean, string or number, but found ${toString(typeOf(needle))} instead.`);
        }

        if (!isSearchableRuntimeValue(haystack)) {
            throw new RuntimeError(`Expected second argument to be of type array or string, but found ${toString(typeOf(haystack))} instead.`);
        }

        if (this.fromIndex !== undefined) {
            const fromIndex = (this.fromIndex.evaluate(ctx): number);
            return haystack.indexOf(needle, fromIndex);
        }

        return haystack.indexOf(needle);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.needle);
        fn(this.haystack);
        if (this.fromIndex !== undefined) {
            fn(this.fromIndex);
        }
    }

    outputDefined() {
        return false;
    }

    serialize() {
        if (this.fromIndex === undefined) {
            return ["index-of", this.needle.serialize(), this.haystack.serialize()];
        }
        return ["index-of", this.needle.serialize(), this.haystack.serialize(), this.fromIndex.serialize()];
    }
}

export default IndexOf;
