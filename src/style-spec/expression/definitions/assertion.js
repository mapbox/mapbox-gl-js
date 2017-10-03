// @flow

const assert = require('assert');
const {
    ObjectType,
    ValueType,
    StringType,
    NumberType,
    BooleanType
} = require('../types');

const RuntimeError = require('../runtime_error');
const {checkSubtype, toString} = require('../types');
const {typeOf} = require('../values');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
import type EvaluationContext from '../evaluation_context';
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
        const type = this.type;
        const args = this.args.map(arg => ctx.compileAndCache(arg));
        return (ctx: EvaluationContext) => evaluate(ctx, type, args);
    }

    serialize() {
        return [ this.type.kind.toLowerCase() ].concat(this.args.map(i => i.serialize()));
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }
}

module.exports = Assertion;

function evaluate(ctx, type, args) {
    for (let i = 0; i < args.length; i++) {
        const value = args[i](ctx);
        const error = checkSubtype(type, typeOf(value));
        if (!error) {
            return value;
        } else if (i === args.length - 1) {
            throw new RuntimeError(`Expected value to be of type ${toString(type)}, but found ${toString(typeOf(value))} instead.`);
        }
    }

    assert(false);
    return null;
}
