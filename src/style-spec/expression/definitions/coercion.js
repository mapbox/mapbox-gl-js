// @flow

import assert from 'assert';

import {BooleanType, ColorType, NumberType, StringType, ValueType} from '../types.js';
import {Color, toString as valueToString, validateRGBA} from '../values.js';
import RuntimeError from '../runtime_error.js';
import Formatted from '../types/formatted.js';
import FormatExpression from '../definitions/format.js';
import ImageExpression from '../definitions/image.js';
import ResolvedImage from '../types/resolved_image.js';

import type {Expression} from '../expression.js';
import type ParsingContext from '../parsing_context.js';
import type EvaluationContext from '../evaluation_context.js';
import type {Type} from '../types.js';

const types = {
    'to-boolean': BooleanType,
    'to-color': ColorType,
    'to-number': NumberType,
    'to-string': StringType
};

/**
 * Special form for error-coalescing coercion expressions "to-number",
 * "to-color".  Since these coercions can fail at runtime, they accept multiple
 * arguments, only evaluating one at a time until one succeeds.
 *
 * @private
 */
class Coercion implements Expression {
    type: Type;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 2)
            return context.error(`Expected at least one argument.`);

        const name: string = (args[0]: any);
        assert(types[name], name);

        if ((name === 'to-boolean' || name === 'to-string') && args.length !== 2)
            return context.error(`Expected one argument.`);

        const type = types[name];

        const parsed = [];
        for (let i = 1; i < args.length; i++) {
            const input = context.parse(args[i], i, ValueType);
            if (!input) return null;
            parsed.push(input);
        }

        return new Coercion(type, parsed);
    }

    evaluate(ctx: EvaluationContext) {
        if (this.type.kind === 'boolean') {
            return Boolean(this.args[0].evaluate(ctx));
        } else if (this.type.kind === 'color') {
            let input;
            let error;
            for (const arg of this.args) {
                input = arg.evaluate(ctx);
                error = null;
                if (input instanceof Color) {
                    return input;
                } else if (typeof input === 'string') {
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
            throw new RuntimeError(error || `Could not parse color from value '${typeof input === 'string' ? input : String(JSON.stringify(input))}'`);
        } else if (this.type.kind === 'number') {
            let value = null;
            for (const arg of this.args) {
                value = arg.evaluate(ctx);
                if (value === null) return 0;
                const num = Number(value);
                if (isNaN(num)) continue;
                return num;
            }
            throw new RuntimeError(`Could not convert ${JSON.stringify(value)} to number.`);
        } else if (this.type.kind === 'formatted') {
            // There is no explicit 'to-formatted' but this coercion can be implicitly
            // created by properties that expect the 'formatted' type.
            return Formatted.fromString(valueToString(this.args[0].evaluate(ctx)));
        } else if (this.type.kind === 'resolvedImage') {
            return ResolvedImage.fromString(valueToString(this.args[0].evaluate(ctx)));
        } else {
            return valueToString(this.args[0].evaluate(ctx));
        }
    }

    eachChild(fn: (_: Expression) => void) {
        this.args.forEach(fn);
    }

    outputDefined(): boolean {
        return this.args.every(arg => arg.outputDefined());
    }

    serialize() {
        if (this.type.kind === 'formatted') {
            return new FormatExpression([{content: this.args[0], scale: null, font: null, textColor: null}]).serialize();
        }

        if (this.type.kind === 'resolvedImage') {
            return new ImageExpression(this.args[0]).serialize();
        }

        const serialized = [`to-${this.type.kind}`];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Coercion;
