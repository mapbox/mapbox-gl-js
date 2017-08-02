// @flow

const {
    NumberType,
    ColorType
} = require('../types');
const { parseExpression } = require('../expression');

import type { Expression } from '../expression';
import type { Type } from '../types';

export type InterpolationType =
    { name: 'step' } |
    { name: 'linear' } |
    { name: 'exponential', base: number };

type Stops = Array<[number, Expression]>;

class Curve implements Expression {
    key: string;
    type: Type;

    interpolation: InterpolationType;
    input: Expression;
    stops: Stops;

    constructor(key: string, interpolation: InterpolationType, input: Expression, stops: Stops) {
        this.key = key;
        this.type = stops[0][1].type;
        this.interpolation = interpolation;
        this.input = input;
        this.stops = stops;
    }

    static parse(args, context) {
        args = args.slice(1);
        if (args.length < 4)
            return context.error(`Expected at least 2 arguments, but found only ${args.length}.`);

        let [interpolation, input, ...rest] = args;

        if (!Array.isArray(interpolation) || interpolation.length === 0) {
            return context.error(`Expected an interpolation type expression, but found ${String(interpolation)} instead.`, 1);
        }

        if (interpolation[0] === 'step') {
            interpolation = { name: 'step' };
        } else if (interpolation[0] === 'linear') {
            interpolation = { name: 'linear' };
        } else if (interpolation[0] === 'exponential') {
            const base = interpolation[1];
            if (typeof base !== 'number')
                return context.error(`Exponential interpolation requires a numeric base.`, 1, 1);
            interpolation = {
                name: 'exponential',
                base
            };
        } else {
            return context.error(`Unknown interpolation type ${String(interpolation[0])}`, 1, 0);
        }

        input = parseExpression(input, context.concat(2, 'curve'), NumberType);
        if (!input) return null;

        const stops: Stops = [];

        let outputType: Type = (null: any);
        for (let i = 0; i < rest.length; i += 2) {
            const label = rest[i];
            const value = rest[i + 1];

            if (typeof label !== 'number') {
                return context.error('Input/output pairs for "curve" expressions must be defined using literal numeric values (not computed expressions) for the input values.', i + 3);
            }

            if (stops.length && stops[stops.length - 1][0] > label) {
                return context.error('Input/output pairs for "curve" expressions must be arranged with input values in strictly ascending order.', i + 3);
            }

            const parsed = parseExpression(value, context.concat(i + 4, 'curve'), outputType);
            if (!parsed) return null;
            outputType = parsed.type;
            stops.push([label, parsed]);
        }

        if (interpolation.name !== 'step' &&
            outputType !== NumberType &&
            outputType !== ColorType &&
            !(outputType.kind === 'array' && outputType.itemType === NumberType)) {
            return context.error(`Type ${outputType.name} is not interpolatable, and thus cannot be used as a ${interpolation.name} curve's output type.`, 1);
        }

        return new Curve(context.key, interpolation, input, stops);
    }

    compile() {
        const input = this.input.compile();

        const labels = [];
        const outputs = [];
        for (const [label, expression] of this.stops) {
            labels.push(label);
            outputs.push(`function () { return ${expression.compile()}; }.bind(this)`);
        }

        const interpolationType =
            this.type === ColorType ? 'color' :
            this.type.kind === 'array' ? 'array' : 'number';

        return `this.evaluateCurve(
            ${input},
            [${labels.join(',')}],
            [${outputs.join(',')}],
            ${JSON.stringify(this.interpolation)},
            ${JSON.stringify(interpolationType)})`;
    }

    serialize() {
        const result = ['curve'];
        const interp = [this.interpolation.name];
        if (this.interpolation.name === 'exponential') {
            interp.push(this.interpolation.base);
        }
        result.push(interp);
        result.push(this.input.serialize());
        for (const [label, expression] of this.stops) {
            result.push(label);
            result.push(expression.serialize());
        }
        return result;
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        this.input.accept(visitor);
        for (const [ , expression] of this.stops) {
            expression.accept(visitor);
        }
    }
}

module.exports = Curve;
