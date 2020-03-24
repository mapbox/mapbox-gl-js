// @flow

import assert from 'assert';

import {ValueType, BooleanType, toString, NumberType} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';
import type {Value} from '../values';

const types = {
    'in': BooleanType,
    'index-of': NumberType
};

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
           needle === null;
}

function isSearchableRuntimeValue(haystack: Array<Value> | string) {
    return Array.isArray(haystack) ||
           typeof haystack === 'string';
}

class In implements Expression {
    type: Type;
    needle: Expression;
    haystack: Expression;
    fromIndex: ?Expression;

    constructor(type: Type, needle: Expression, haystack: Expression, fromIndex?: Expression) {
        this.type = type;
        this.needle = needle;
        this.haystack = haystack;
        this.fromIndex = fromIndex;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        const name: string = (args[0]: any);
        assert(types[name], name);

        if (name === 'in' && args.length !== 3) {
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);
        }

        if (name === 'index-of' && (args.length <= 2 ||  args.length >= 5))
            return context.error(`Expected 3 or 4 arguments, but found ${args.length - 1} instead.`);

        const type = types[name];

        const needle = context.parse(args[1], 1, ValueType);

        const haystack = context.parse(args[2], 2, ValueType);

        if (!needle || !haystack) return null;

        if (!isComparableType(needle.type)) {
            return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${toString(needle.type)} instead`);
        }

        if (args.length === 4) {
            const fromIndex = context.parse(args[3], 3, NumberType);
            if (!fromIndex) return null;
            return new In(type, needle, haystack, fromIndex);
        } else {
            return new In(type, needle, haystack);
        }
    }

    evaluate(ctx: EvaluationContext) {
        const needle = (this.needle.evaluate(ctx): any);
        const haystack = (this.haystack.evaluate(ctx): any);

        if (!haystack && this.type.kind === 'boolean') return false;

        if (!isComparableRuntimeValue(needle)) {
            throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${toString(typeOf(needle))} instead.`);
        }

        if (!isSearchableRuntimeValue(haystack)) {
            throw new RuntimeError(`Expected second argument to be of type array or string, but found ${toString(typeOf(haystack))} instead.`);
        }

        const fromIndex = this.fromIndex ? (this.fromIndex.evaluate(ctx): number) : 0;

        if (this.type.kind === 'boolean') {
            return haystack.indexOf(needle, fromIndex) >= 0;
        } else {
            return haystack.indexOf(needle, fromIndex);
        }

    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.needle);
        fn(this.haystack);
        if (this.fromIndex) {
            fn(this.fromIndex);
        }
    }

    outputDefined() {
        return true;
    }

    serialize() {
        const op = this.type.kind === 'boolean' ? 'in' : 'index-of';

        if (this.fromIndex != null && this.fromIndex !== undefined) {
            const fromIndex = this.fromIndex.serialize();
            return [op, this.needle.serialize(), this.haystack.serialize(), fromIndex];
        }
        return [op, this.needle.serialize(), this.haystack.serialize()];
    }
}

export default In;
