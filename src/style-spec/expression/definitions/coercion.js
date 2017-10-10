// @flow

const assert = require('assert');
const {
    ColorType,
    ValueType,
    NumberType,
} = require('../types');

const { Color, validateRGBA, unwrap } = require('../values');
const RuntimeError = require('../runtime_error');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
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
            const input = context.parse(args[i], i, ValueType);
            if (!input) return null;
            parsed.push(input);
        }

        return new Coercion(context.key, type, parsed);
    }

    evaluate(ctx: EvaluationContext) {
        if (this.type.kind === 'color') {
            let input;
            let error;
            for (const arg of this.args) {
                input = arg.evaluate(ctx);
                error = null;
                if (typeof input === 'string') {
                    const c = ctx.parseColor(input);
                    if (c) return c;
                } else if (Array.isArray(input)) {
                    if (input.length < 3 || input.length > 4) {
                        error = `Invalid rbga value ${JSON.stringify(input)}: expected an array containing either three or four numeric values.`;
                    } else {
                        error = validateRGBA(input[0], input[1], input[2], input[3]);
                    }
                    if (!error) {
                        return new Color((input[0]: any) / 255, (input[1]: any) / 255, (input[2]: any) / 255, (input[3]: any));
                    }
                }
            }
            throw new RuntimeError(error || `Could not parse color from value '${typeof input === 'string' ? input : JSON.stringify(input)}'`);
        } else {
            let value = null;
            for (const arg of this.args) {
                value = arg.evaluate(ctx);
                if (value === null) continue;
                const num = Number(value);
                if (isNaN(num)) continue;
                return num;
            }
            throw new RuntimeError(`Could not convert ${JSON.stringify(unwrap(value))} to number.`);
        }
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }
}

module.exports = Coercion;
