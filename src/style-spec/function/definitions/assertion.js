// @flow

const assert = require('assert');
const parseExpression = require('../parse_expression');
const {
    ObjectType,
    ValueType,
    StringType,
    NumberType,
    BooleanType
} = require('../types');

import type { Expression, ParsingContext, CompilationContext } from '../expression';
import type { Type } from '../types';

const types = {
    string: StringType,
    number: NumberType,
    boolean: BooleanType,
    object: ObjectType
};

class Assertion implements Expression {
    key: string;
    type: Type;
    inputs: Array<Expression>;

    constructor(key: string, type: Type, inputs: Array<Expression>) {
        this.key = key;
        this.type = type;
        this.inputs = inputs;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 2)
            return context.error(`Expected at least one argument.`);

        const name: string = (args[0]: any);
        assert(types[name], name);

        const type = types[name];

        const inputs = [];
        for (let i = 1; i < args.length; i++) {
            const input = parseExpression(args[i], context.concat(i, ValueType));
            if (!input) return null;
            inputs.push(input);
        }

        return new Assertion(context.key, type, inputs);
    }

    compile(ctx: CompilationContext) {
        const jsType = JSON.stringify(this.type.kind.toLowerCase());
        const inputs = [];
        for (const input of this.inputs) {
            inputs.push(ctx.addExpression(input.compile(ctx)));
        }
        const inputsVar = ctx.addVariable(`[${inputs.join(',')}]`);
        return `$this.asJSType(${jsType}, ${inputsVar})`;
    }

    serialize() {
        return [ this.type.kind.toLowerCase() ].concat(this.inputs.map(i => i.serialize()));
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        this.inputs.forEach(input => input.accept(visitor));
    }
}

module.exports = Assertion;
