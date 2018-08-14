// @flow

import assert from 'assert';

import { toString, array, ValueType, StringType, NumberType, BooleanType, checkSubtype } from '../types';

import { typeOf } from '../values';
import RuntimeError from '../runtime_error';

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { ArrayType } from '../types';
import type { Value } from '../values';

const types = {
    string: StringType,
    number: NumberType,
    boolean: BooleanType
};

class ArrayAssertion implements Expression {
    type: ArrayType;
    args: Array<Expression>;

    constructor(type: ArrayType, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 2)
            return context.error(`Expected at least one argument.`);

        let i = 1;

        let itemType;
        if (args.length > 2) {
            const type = args[1];
            if (typeof type !== 'string' || !(type in types))
                return context.error('The item type argument of "array" must be one of string, number, boolean', 1);
            itemType = types[type];
            i++;
        } else {
            itemType = ValueType;
        }

        let N;
        if (args.length > 3) {
            if (args[2] !== null &&
                (typeof args[2] !== 'number' ||
                    args[2] < 0 ||
                    args[2] !== Math.floor(args[2]))
            ) {
                return context.error('The length argument to "array" must be a positive integer literal', 2);
            }
            N = args[2];
            i++;
        }

        const type = array(itemType, N);

        const parsed = [];
        for (; i < args.length; i++) {
            const input = context.parse(args[i], i, ValueType);
            if (!input) return null;
            parsed.push(input);
        }

        return new ArrayAssertion(type, parsed);
    }

    evaluate(ctx: EvaluationContext) {
        for (let i = 0; i < this.args.length; i++) {
            const value = this.args[i].evaluate(ctx);
            const error = checkSubtype(this.type, typeOf(value));
            if (!error) {
                return value;
            } else if (i === this.args.length - 1) {
                throw new RuntimeError(`Expected value to be of type ${toString(this.type)}, but found ${toString(typeOf(value))} instead.`);
            }
        }

        assert(false);
        return null;
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }

    possibleOutputs(): Array<Value | void> {
        return [].concat(...this.args.map((arg) => arg.possibleOutputs()));
    }

    serialize(): Array<mixed> {
        const serialized = ["array"];
        const itemType = this.type.itemType;
        if (itemType.kind === 'string' ||
            itemType.kind === 'number' ||
            itemType.kind === 'boolean') {
            serialized.push(itemType.kind);
            const N = this.type.N;
            if (typeof N === 'number' || this.args.length > 1) {
                serialized.push(N);
            }
        }
        return serialized.concat(this.args.map(arg => arg.serialize()));
    }
}

export default ArrayAssertion;
