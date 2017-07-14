// @flow

const { ParsingError } = require('../expression');
const { Color, isValue, typeOf } = require('../values');

import type { Type } from '../types';
import type { Value }  from '../values';
import type { Expression, ParsingContext }  from '../expression';

class LiteralExpression implements Expression {
    key: string;
    type: Type;
    value: Value;

    constructor(key: *, type: Type, value: Value) {
        this.key = key;
        this.type = type;
        this.value = value;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 1)
            throw new ParsingError(context.key, `'literal' expression requires exactly one argument, but found ${args.length} instead.`);

        if (!isValue(args[0]))
            throw new ParsingError(context.key, `invalid value`);

        const value = (args[0] : any);
        const type = typeOf(value);

        return new this(context.key, type, value);
    }

    compile() {
        const value = JSON.stringify(this.value);
        return typeof this.value === 'object' ?  `(${value})` : value;
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

    visit(fn: (Expression) => void) { fn(this); }
}

module.exports = LiteralExpression;
