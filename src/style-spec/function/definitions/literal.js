// @flow

const { Color, isValue, typeOf } = require('../values');

import type { Type } from '../types';
import type { Value }  from '../values';
import type { Expression, ParsingContext }  from '../expression';

const u2028 = /\u2028/g;
const u2029 = /\u2029/g;

class Literal implements Expression {
    key: string;
    type: Type;
    value: Value;

    constructor(key: *, type: Type, value: Value) {
        this.key = key;
        this.type = type;
        this.value = value;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 2)
            return context.error(`'literal' expression requires exactly one argument, but found ${args.length - 1} instead.`);

        if (!isValue(args[1]))
            return context.error(`invalid value`);

        const value = (args[1]: any);
        let type = typeOf(value);

        // special case: infer the item type if possible for zero-length arrays
        const expected = context.expectedType;
        if (
            type.kind === 'Array' &&
            type.N === 0 &&
            expected &&
            expected.kind === 'Array' &&
            (typeof expected.N !== 'number' || expected.N === 0)
        ) {
            type = expected;
        }

        return new Literal(context.key, type, value);
    }

    compile() {
        const value = Literal.compile(this.value);
        return typeof this.value === 'object' ?  `(${value})` : value;
    }

    static compile(value: Value) {
        let literal = JSON.stringify(value);
        // http://timelessrepo.com/json-isnt-a-javascript-subset
        if (literal.indexOf('\u2028') >= 0) {
            literal = literal.replace(u2028, '\\u2028');
        }
        if (literal.indexOf('\u2029') >= 0) {
            literal = literal.replace(u2029, '\\u2029');
        }
        return literal;
    }

    serialize() {
        if (this.value === null || typeof this.value === 'string' || typeof this.value === 'boolean' || typeof this.value === 'number') {
            return this.value;
        } else if (this.value instanceof Color) {
            return ["rgba"].concat(this.value.value);
        } else {
            return ["literal", this.value];
        }
    }

    eachChild() {}
}

module.exports = Literal;
