// @flow

const assert = require('assert');
const {
    ObjectType,
    ValueType,
    StringType,
    NumberType,
    BooleanType
} = require('../types');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
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
    args: Array<Expression>;

    constructor(key: string, type: Type, args: Array<Expression>) {
        this.key = key;
        this.type = type;
        this.args = args;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 2)
            return context.error(`Expected at least one argument.`);

        const name: string = (args[0]: any);
        assert(types[name], name);

        const type = types[name];

        const parsed = [];
        for (let i = 1; i < args.length; i++) {
            const input = context.parse(args[i], i, ValueType);
            if (!input) return null;
            parsed.push(input);
        }

        return new Assertion(context.key, type, parsed);
    }

    compile(ctx: CompilationContext) {
        const jsType = JSON.stringify(this.type.kind.toLowerCase());
        const args = [];
        for (const input of this.args) {
            args.push(ctx.addExpression(input.compile(ctx)));
        }
        const inputsVar = ctx.addVariable(`[${args.join(',')}]`);
        return `$this.asJSType(${jsType}, ${inputsVar})`;
    }

    serialize() {
        return [ this.type.kind.toLowerCase() ].concat(this.args.map(i => i.serialize()));
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }
}

module.exports = Assertion;
