// @flow

const assert = require('assert');
const {
    match,
    NumberType,
    ColorType
} = require('../types');

const { ParsingError, parseExpression } = require('../expression');

import type { Expression, Scope } from '../expression';
import type { Type, TypeError } from '../types';

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
            throw new ParsingError(context.key, `Expected at least 2 arguments, but found only ${args.length}.`);

        let [interpolation, input, ...rest] = args;

        if (!Array.isArray(interpolation) || interpolation.length === 0) {
            throw new ParsingError(`${context.key}[1]`, `Expected an interpolation type expression, but found ${String(interpolation)} instead.`);
        }

        if (interpolation[0] === 'step') {
            interpolation = { name: 'step' };
        } else if (interpolation[0] === 'linear') {
            interpolation = { name: 'linear' };
        } else if (interpolation[0] === 'exponential') {
            const base = interpolation[1];
            if (typeof base !== 'number')
                throw new ParsingError(`${context.key}[1][1]`, `Exponential interpolation requires a numeric base.`);
            interpolation = {
                name: 'exponential',
                base
            };
        } else {
            throw new ParsingError(`${context.key}[1][0]`, `Unknown interpolation type ${String(interpolation[0])}`);
        }

        input = parseExpression(input, context.concat(2, 'curve'));

        const stops: Stops = [];

        for (let i = 0; i < rest.length; i += 2) {
            const label = rest[i];
            const value = rest[i + 1];

            if (typeof label !== 'number') {
                throw new ParsingError(`${context.key}[${i + 3}]`, 'Input/output pairs for "curve" expressions must be defined using literal numeric values (not computed expressions) for the input values.');
            }

            if (stops.length && stops[stops.length - 1][0] > label) {
                throw new ParsingError(`${context.key}[${i + 3}]`, 'Input/output pairs for "curve" expressions must be arranged with input values in strictly ascending order.');
            }

            stops.push([label, parseExpression(value, context.concat(i + 4, 'curve'))]);
        }

        return new Curve(context.key, interpolation, input, stops);
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        const input = this.input.typecheck(scope, errors);
        if (!input) return null;
        if (match(NumberType, input.type, input.key, errors))
            return null;

        let outputType: Type = (null: any);
        const stops = [];
        for (const [stop, expression] of this.stops) {
            const result = expression.typecheck(scope, errors);
            if (!result) return null;
            if (!outputType) {
                outputType = result.type;
            } else {
                if (match(outputType, result.type, result.key, errors))
                    return null;
            }
            stops.push([stop, result]);
        }

        assert(outputType);

        if (this.interpolation.name !== 'step' &&
            outputType !== NumberType &&
            outputType !== ColorType &&
            !(outputType.kind === 'array' && outputType.itemType === NumberType)) {
            errors.push({
                key: this.stops[0][1].key,
                error: `Type ${outputType.name} is not interpolatable, and thus cannot be used as a ${this.interpolation.name} curve's output type.`
            });
            return null;
        }

        return new Curve(this.key, this.interpolation, input, stops);
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

    visit(fn: (Expression) => void) {
        fn(this);
        this.input.visit(fn);
        for (const [ , expression] of this.stops) {
            expression.visit(fn);
        }
    }
}

module.exports = Curve;
