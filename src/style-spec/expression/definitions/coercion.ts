import assert from 'assert';
import {BooleanType, ColorType, NumberType, StringType, ValueType, array, NullType} from '../types';
import {Color, isValue, toString as valueToString, typeOf, validateRGBA} from '../values';
import RuntimeError from '../runtime_error';
import Formatted from '../types/formatted';
import FormatExpression from '../definitions/format';
import ImageExpression from '../definitions/image';
import ResolvedImage from '../types/resolved_image';
import getType from '../../util/get_type';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type, ArrayType} from '../types';

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
    type: Type | ArrayType;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression | null | undefined {
        if (args.length < 2)
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
            return context.error(`Expected at least one argument.`);

        const name: string = (args[0] as any);
        const parsed = [];
        let type: Type | ArrayType = NullType;
        if (name === 'to-array') {
            if (!Array.isArray(args[1])) {
                return null;
            }
            const arrayLength = args[1].length;
            if (context.expectedType) {
                if (context.expectedType.kind === 'array') {
                    type = array(context.expectedType.itemType, arrayLength);
                } else {
                    // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
                    return context.error(`Expected ${context.expectedType.kind} but found array.`);
                }
            } else if (arrayLength > 0 && isValue(args[1][0])) {
                const value = (args[1][0]);
                type = array(typeOf(value), arrayLength);
            } else {
                return null;
            }
            for (let i = 0; i < arrayLength; i++) {
                const member = args[1][i];
                let parsedMember;
                if (getType(member) === 'array') {
                    parsedMember = context.parse(member, undefined, type.itemType);
                } else {
                    const memberType = getType(member);
                    if (memberType !== type.itemType.kind) {
                        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
                        return context.error(`Expected ${type.itemType.kind} but found ${memberType}.`);
                    }
                    parsedMember = context.registry['literal'].parse(['literal', member === undefined ? null : member], context);
                }
                if (!parsedMember) return null;
                parsed.push(parsedMember);
            }
        } else {
            assert(types[name], name);

            if ((name === 'to-boolean' || name === 'to-string') && args.length !== 2)
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
                return context.error(`Expected one argument.`);

            type = types[name];

            for (let i = 1; i < args.length; i++) {
                const input = context.parse(args[i], i, ValueType);
                if (!input) return null;
                parsed.push(input);
            }
        }

        return new Coercion(type, parsed);
    }

    evaluate(ctx: EvaluationContext): any {
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
                        return new Color((input[0]) / 255, (input[1]) / 255, (input[2]) / 255, (input[3]));
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
        } else if (this.type.kind === 'array') {
            return this.args.map(arg => { return arg.evaluate(ctx); });
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

    serialize(): SerializedExpression {
        if (this.type.kind === 'formatted') {
            return new FormatExpression([{content: this.args[0], scale: null, font: null, textColor: null}]).serialize();
        }

        if (this.type.kind === 'resolvedImage') {
            return new ImageExpression(this.args[0]).serialize();
        }

        const serialized: Array<unknown> = this.type.kind === 'array' ? [] : [`to-${this.type.kind}`];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Coercion;
