// @flow

const { parseExpression, ParsingError } = require('../expression');
const {
    array,
    ValueType,
    NumberType
} = require('../types');

import type { Expression, Scope } from '../expression';
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

    static parse(args, context) {
        if (args.length !== 3)
            throw new ParsingError(context.key, `Expected 2 arguments, but found ${args.length - 1} instead.`);

        const index = parseExpression(args[1], context.concat(1, 'at'), NumberType);
        const input = parseExpression(args[2], context.concat(2, 'at'), array(ValueType));

        if (!index || !input) return null;

        const t: ArrayType = (input.type: any);
        return new At(context.key, t.itemType, index, input);
    }

    compile() {
        return `this.at(${this.index.compile()}, ${this.input.compile()})`;
    }

    serialize() {
        return [ 'at', this.index.serialize(), this.input.serialize() ];
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        this.index.accept(visitor);
        this.input.accept(visitor);
    }
}

module.exports = At;
