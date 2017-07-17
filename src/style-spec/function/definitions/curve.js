// @flow

const {
    NumberType,
    ColorType,
    typename
} = require('../types');

const { ParsingError, parseExpression } = require('../expression');

import type { Expression, Scope } from '../expression';
import type { Type } from '../types';

export type InterpolationType =
    { name: 'step' } |
    { name: 'linear' } |
    { name: 'exponential', base: number };

type Stops = Array<[number, Expression]>;

class CurveExpression implements Expression {
    key: string;
    type: Type;

    interpolation: InterpolationType;
    input: Expression;
    stops: Stops;

    constructor(key: string, interpolation: InterpolationType, input: Expression, stops: Stops) {
        this.key = key;
        this.type = typename('T');
        this.interpolation = interpolation;
        this.input = input;
        this.stops = stops;
    }

    static parse(args, context) {
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

        return new CurveExpression(context.key, interpolation, input, stops);
    }

    typecheck(expected: Type, scope: Scope) {
        const result = this.input.typecheck(typename('T'), scope);
        if (result.result === 'error') {
            return result;
        }

        for (const [ , expression] of this.stops) {
            const result = expression.typecheck(expected || typename('T'), scope);

            if (result.result === 'error') {
                return result;
            }

            expected = result.expression.type;
        }

        if (this.interpolation.name !== 'step' &&
            expected !== NumberType &&
            expected !== ColorType &&
            !(expected.kind === 'array' && expected.itemType === NumberType)) {
            return {
                result: 'error',
                errors: [{
                    key: this.stops[0][1].key,
                    error: `Type ${expected.name} is not interpolatable, and thus cannot be used as a ${this.interpolation.name} curve's output type.`
                }]
            };
        }

        this.type = expected;

        return {
            result: 'success',
            expression: this
        };
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

module.exports = CurveExpression;
