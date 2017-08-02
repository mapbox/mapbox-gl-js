// @flow

const { parseExpression, ParsingError } = require('../expression');
const {
    array,
    ValueType,
    StringType,
    NumberType,
    BooleanType,
    match
} = require('../types');

import type { Expression, Scope } from '../expression';
import type { ArrayType, TypeError } from '../types';

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
            throw new ParsingError(context.key, `Expected 1, 2, or 3 arguments, but found ${args.length - 1} instead.`);

        const input = parseExpression(args[args.length - 1], context.concat(args.length - 1, 'array'));

        let itemType;
        let N;
        if (args.length > 2) {
            const type = args[1];
            if (!(type in types))
                throw new ParsingError(`${context.key}[1]`, 'The item type argument of "array" must be one of string, number, boolean');
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
                throw new ParsingError(`${context.key}[2]`, 'The length argument to "array" must be a positive integer literal');
            }
            N = args[2];
        }

        return new ArrayAssertion(context.key, array(itemType, N), input);
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        const checkedInput = this.input.typecheck(scope, errors);
        if (!checkedInput) return null;
        if (match(ValueType, checkedInput.type, checkedInput.key, errors))
            return null;
        return new ArrayAssertion(this.key, this.type, checkedInput);
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

    visit(fn: (Expression) => void) {
        fn(this);
        fn(this.input);
    }
}

module.exports = ArrayAssertion;
