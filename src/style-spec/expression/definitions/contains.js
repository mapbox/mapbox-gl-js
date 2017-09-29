// @flow

const parseExpression = require('../parse_expression');
const {
    array,
    BooleanType,
    ValueType
} = require('../types');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
import type { Type, ArrayType } from '../types';

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

        const arrayExpr = parseExpression(args[2], context.concat(2, array(ValueType)));
        if (!arrayExpr) return null;

        const t: ArrayType = (arrayExpr.type: any);
        const value = parseExpression(args[1], context.concat(1, t.itemType));
        if (!value) return null;

        const itemType = value.type.kind;
        if (itemType === 'Object' || itemType === 'Array' || itemType === 'Color') {
            return context.error(`"contains" does not support values of type ${itemType}.`);
        }

        return new Contains(context.key, value, arrayExpr);
    }

    compile(ctx: CompilationContext) {
        return `$this.contains(${ctx.compileAndCache(this.value)}, ${ctx.compileAndCache(this.array)})`;
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
