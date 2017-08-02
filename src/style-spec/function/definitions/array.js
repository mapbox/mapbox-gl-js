// @flow

const { parseExpression } = require('../expression');
const {
    array,
    ValueType,
    StringType,
    NumberType,
    BooleanType
} = require('../types');

import type { Expression } from '../expression';
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

    static parse(args, context) {
        if (args.length < 2 || args.length > 4)
            return context.error(`Expected 1, 2, or 3 arguments, but found ${args.length - 1} instead.`);

        let itemType;
        let N;
        if (args.length > 2) {
            const type = args[1];
            if (!(type in types))
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

        const input = parseExpression(args[args.length - 1], context.concat(args.length - 1, 'array'), ValueType);
        if (!input) return null;

        return new ArrayAssertion(context.key, type, input);
    }

    compile() {
        return `this.as(${this.input.compile()}, '${this.type.name}')`;
    }

    serialize() {
        if (typeof this.type.N === 'number') {
            return [ 'array', this.type.itemType.name, this.type.N, this.input.serialize() ];
        } else if (this.type.itemType !== ValueType) {
            return [ 'array', this.type.itemType.name, this.input.serialize() ];
        } else {
            return [ 'array', this.input.serialize() ];
        }
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        this.input.accept(visitor);
    }
}

module.exports = ArrayAssertion;
