// @flow

const {
    toString,
    array,
    ValueType,
    StringType,
    NumberType,
    BooleanType,
    checkSubtype
} = require('../types');

const {typeOf} = require('../values');
const RuntimeError = require('../runtime_error');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
import type EvaluationContext from '../evaluation_context';
import type { ArrayType } from '../types';

const types = {
    string: StringType,
    number: NumberType,
    boolean: BooleanType
};

class ArrayAssertion implements Expression {
    key: string;
    type: ArrayType;
    input: Expression;

    constructor(key: string, type: ArrayType, input: Expression) {
        this.key = key;
        this.type = type;
        this.input = input;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 2 || args.length > 4)
            return context.error(`Expected 1, 2, or 3 arguments, but found ${args.length - 1} instead.`);

        let itemType;
        let N;
        if (args.length > 2) {
            const type = args[1];
            if (typeof type !== 'string' || !(type in types))
                return context.error('The item type argument of "array" must be one of string, number, boolean', 1);
            itemType = types[type];
        } else {
            itemType = ValueType;
        }

        if (args.length > 3) {
            if (
                typeof args[2] !== 'number' ||
                args[2] < 0 ||
                args[2] !== Math.floor(args[2])
            ) {
                return context.error('The length argument to "array" must be a positive integer literal', 2);
            }
            N = args[2];
        }

        const type = array(itemType, N);

        const input = context.parse(args[args.length - 1], args.length - 1, ValueType);
        if (!input) return null;

        return new ArrayAssertion(context.key, type, input);
    }

    compile(ctx: CompilationContext) {
        const input = ctx.compileAndCache(this.input);
        const type = this.type;
        return (ctx: EvaluationContext) => evaluate(ctx, type, input);
    }

    serialize() {
        if (typeof this.type.N === 'number') {
            return [ 'array', toString(this.type.itemType), this.type.N, this.input.serialize() ];
        } else if (this.type.itemType.kind !== 'value') {
            return [ 'array', toString(this.type.itemType), this.input.serialize() ];
        } else {
            return [ 'array', this.input.serialize() ];
        }
    }

    eachChild(fn: (Expression) => void) {
        fn(this.input);
    }
}

module.exports = ArrayAssertion;

function evaluate(ctx, type, input) {
    const value = input(ctx);
    const error = checkSubtype(type, typeOf(value));
    if (error) {
        throw new RuntimeError(`Expected value to be of type ${toString(type)}, but found ${toString(typeOf(value))} instead.`);
    }
    return value;
}
