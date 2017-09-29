// @flow

const assert = require('assert');
const parseExpression = require('../parse_expression');
const {
    ColorType,
    ValueType,
    NumberType,
} = require('../types');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type CompilationContext  from '../compilation_context';
import type { Type } from '../types';

const types = {
    'to-number': NumberType,
    'to-color': ColorType
};

/**
 * Special form for error-coalescing coercion expressions "to-number",
 * "to-color".  Since these coercions can fail at runtime, they accept multiple
 * arguments, only evaluating one at a time until one succeeds.
 *
 * @private
 */
class Coercion implements Expression {
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
            const input = parseExpression(args[i], context.concat(i, ValueType));
            if (!input) return null;
            parsed.push(input);
        }

        return new Coercion(context.key, type, parsed);
    }

    compile(ctx: CompilationContext) {
        const args = [];
        for (const input of this.args) {
            args.push(ctx.addExpression(input.compile(ctx)));
        }
        const inputsVar = ctx.addVariable(`[${args.join(',')}]`);
        return `$this.to${this.type.kind}(${inputsVar})`;
    }

    serialize() {
        return [ `to-${this.type.kind.toLowerCase()}` ].concat(this.args.map(i => i.serialize()));
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }
}

module.exports = Coercion;
