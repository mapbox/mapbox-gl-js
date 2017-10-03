// @flow

const {
    array,
    ValueType,
    NumberType
} = require('../types');

const RuntimeError = require('../runtime_error');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
import type EvaluationContext from '../evaluation_context';
import type { Type, ArrayType } from '../types';
import type { Value } from '../values';

class At implements Expression {
    key: string;
    type: Type;
    index: Expression;
    input: Expression;

    constructor(key: string, type: Type, index: Expression, input: Expression) {
        this.key = key;
        this.type = type;
        this.index = index;
        this.input = input;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 3)
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);

        const index = context.parse(args[1], 1, NumberType);
        const input = context.parse(args[2], 2, array(context.expectedType || ValueType));

        if (!index || !input) return null;

        const t: ArrayType = (input.type: any);
        return new At(context.key, t.itemType, index, input);
    }

    compile(ctx: CompilationContext) {
        const index = ctx.compileAndCache(this.index);
        const input = ctx.compileAndCache(this.input);
        return (ctx: EvaluationContext) => evaluate(ctx, index, input);
    }

    serialize() {
        return [ 'at', this.index.serialize(), this.input.serialize() ];
    }

    eachChild(fn: (Expression) => void) {
        fn(this.index);
        fn(this.input);
    }
}

module.exports = At;

function evaluate(ctx, index_, array_) {
    const index = ((index_(ctx): any): number);
    const array = ((array_(ctx): any): Array<Value>);
    if (index < 0 || index >= array.length) {
        throw new RuntimeError(`Array index out of bounds: ${index} > ${array.length}.`);
    }
    if (index !== Math.floor(index)) {
        throw new RuntimeError(`Array index must be an integer, but found ${index} instead.`);
    }
    return array[index];
}
