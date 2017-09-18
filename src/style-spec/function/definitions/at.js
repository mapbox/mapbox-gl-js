// @flow

const parseExpression = require('../parse_expression');
const {
    array,
    ValueType,
    NumberType
} = require('../types');

import type { Expression, ParsingContext, CompilationContext } from '../expression';
import type { Type, ArrayType } from '../types';

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

        const index = parseExpression(args[1], context.concat(1, NumberType));
        const input = parseExpression(args[2], context.concat(2, array(context.expectedType || ValueType)));

        if (!index || !input) return null;

        const t: ArrayType = (input.type: any);
        return new At(context.key, t.itemType, index, input);
    }

    compile(ctx: CompilationContext) {
        return `$this.at(${ctx.compileAndCache(this.index)}, ${ctx.compileAndCache(this.input)})`;
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
