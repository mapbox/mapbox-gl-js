// @flow

const {
    array,
    BooleanType,
    ValueType
} = require('../types');

const { typeOf } = require('../values');
const RuntimeError = require('../runtime_error');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
import type EvaluationContext from '../evaluation_context';
import type { Type, ArrayType } from '../types';
import type { Value } from '../values';

class Contains implements Expression {
    key: string;
    type: Type;
    value: Expression;
    array: Expression;

    constructor(key: string, value: Expression, array: Expression) {
        this.key = key;
        this.type = BooleanType;
        this.value = value;
        this.array = array;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 3)
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);

        const arrayExpr = context.parse(args[2], 2, array(ValueType));
        if (!arrayExpr) return null;

        const t: ArrayType = (arrayExpr.type: any);
        const value = context.parse(args[1], 1, t.itemType);
        if (!value) return null;

        const itemType = value.type.kind;
        if (itemType === 'Object' || itemType === 'Array' || itemType === 'Color') {
            return context.error(`"contains" does not support values of type ${itemType}.`);
        }

        return new Contains(context.key, value, arrayExpr);
    }

    compile(ctx: CompilationContext) {
        const value = ctx.compileAndCache(this.value);
        const array = ctx.compileAndCache(this.array);
        return (ctx: EvaluationContext) => evaluate(ctx, value, array);
    }

    serialize() {
        return [ 'contains', this.value.serialize(), this.array.serialize() ];
    }

    eachChild(fn: (Expression) => void) {
        fn(this.array);
        fn(this.value);
    }
}

module.exports = Contains;

function evaluate(ctx, value_, array_) {
    const value = value_(ctx);
    const type = typeOf(value).kind;
    if (type === 'Object' || type === 'Array' || type === 'Color') {
        throw new RuntimeError(`"contains" does not support values of type ${type}`);
    }
    const array = ((array_(ctx): any): Array<Value>);
    return array.indexOf(value) >= 0;
}
