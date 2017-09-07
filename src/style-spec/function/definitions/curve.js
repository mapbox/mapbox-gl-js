// @flow

const UnitBezier = require('@mapbox/unitbezier');
const {
    toString,
    NumberType
} = require('../types');
const parseExpression = require('../parse_expression');

import type { Expression, ParsingContext, CompilationContext } from '../expression';
import type { Type } from '../types';

export type InterpolationType =
    { name: 'step' } |
    { name: 'linear' } |
    { name: 'exponential', base: number } |
    { name: 'cubic-bezier', controlPoints: [number, number, number, number] };

export type InterpolationCache = {
    pow: {[number]: {[number]: number}},
    unitBezier: {[string]: UnitBezier}
}

type Stops = Array<[number, Expression]>;

class Curve implements Expression {
    key: string;
    type: Type;

    interpolation: InterpolationType;
    input: Expression;
    stops: Stops;

    interpolationCache: InterpolationCache;

    constructor(key: string, type: Type, interpolation: InterpolationType, input: Expression, stops: Stops) {
        this.key = key;
        this.type = type;
        this.interpolation = interpolation;
        this.input = input;
        this.stops = stops;

        this.interpolationCache = {pow: {}, unitBezier: {}};
    }

    static interpolationFactor(interpolation: InterpolationType, input: number, lower: number, upper: number, cache: InterpolationCache) {
        let t = 0;
        if (interpolation.name === 'exponential') {
            t = exponentialInterpolation(input, interpolation.base, lower, upper, cache.pow);
        } else if (interpolation.name === 'linear') {
            t = exponentialInterpolation(input, 1, lower, upper, cache.pow);
        } else if (interpolation.name === 'cubic-bezier') {
            const key = interpolation.controlPoints.join(',');
            let ub = cache.unitBezier[key];
            if (!ub) {
                ub = new UnitBezier(...interpolation.controlPoints);
                if (cache.unitBezier) {
                    cache.unitBezier[key] = ub;
                }
            }
            t = ub.solve(exponentialInterpolation(input, 1, lower, upper, cache.pow));
        }
        return t;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        let [ , interpolation, input, ...rest] = args;

        if (!Array.isArray(interpolation) || interpolation.length === 0) {
            return context.error(`Expected an interpolation type expression.`, 1);
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
        } else if (interpolation[0] === 'cubic-bezier') {
            const controlPoints = interpolation.slice(1);
            if (
                controlPoints.length !== 4 ||
                controlPoints.some(t => typeof t !== 'number' || t < 0 || t > 1)
            ) {
                return context.error('Cubic bezier interpolation requires four numeric arguments with values between 0 and 1.', 1);
            }

            interpolation = {
                name: 'cubic-bezier',
                controlPoints: (controlPoints: any)
            };
        } else {
            return context.error(`Unknown interpolation type ${String(interpolation[0])}`, 1, 0);
        }

        const isStep = interpolation.name === 'step';

        const minArgs = isStep ? 5 : 4;
        if (args.length - 1 < minArgs)
            return context.error(`Expected at least ${minArgs} arguments, but found only ${args.length - 1}.`);

        const parity = minArgs % 2;
        if ((args.length - 1) % 2 !== parity) {
            return context.error(`Expected an ${parity === 0 ? 'even' : 'odd'} number of arguments.`);
        }

        input = parseExpression(input, context.concat(2, NumberType));
        if (!input) return null;

        const stops: Stops = [];

        let outputType: Type = (null: any);
        if (context.expectedType && context.expectedType.kind !== 'Value') {
            outputType = context.expectedType;
        }

        if (isStep) {
            rest.unshift(-Infinity);
        }

        for (let i = 0; i < rest.length; i += 2) {
            const label = rest[i];
            const value = rest[i + 1];

            const labelKey = isStep ? i + 4 : i + 3;
            const valueKey = isStep ? i + 5 : i + 4;

            if (typeof label !== 'number') {
                return context.error('Input/output pairs for "curve" expressions must be defined using literal numeric values (not computed expressions) for the input values.', labelKey);
            }

            if (stops.length && stops[stops.length - 1][0] > label) {
                return context.error('Input/output pairs for "curve" expressions must be arranged with input values in strictly ascending order.', labelKey);
            }

            const parsed = parseExpression(value, context.concat(valueKey, outputType));
            if (!parsed) return null;
            outputType = outputType || parsed.type;
            stops.push([label, parsed]);
        }

        if (interpolation.name !== 'step' &&
            outputType.kind !== 'Number' &&
            outputType.kind !== 'Color' &&
            !(outputType.kind === 'Array' && outputType.itemType.kind === 'Number')) {
            return context.error(`Type ${toString(outputType)} is not interpolatable, and thus cannot be used as a ${interpolation.name} curve's output type.`);
        }

        return new Curve(context.key, outputType, interpolation, input, stops);
    }

    compile(ctx: CompilationContext) {
        const input = ctx.compile(this.input);

        const labels = [];
        const outputs = [];
        for (const [label, expression] of this.stops) {
            labels.push(label);
            outputs.push(ctx.addExpression(expression.compile(ctx)));
        }

        const interpolationType = this.type.kind.toLowerCase();

        const labelVariable = ctx.addVariable(`[${labels.join(',')}]`);
        const outputsVariable = ctx.addVariable(`[${outputs.join(',')}]`);
        const interpolation = ctx.addVariable(JSON.stringify(this.interpolation));
        const interpolationCache = ctx.addVariable(`{pow: {}, unitBezier: {}}`);

        return `$this.evaluateCurve(${input}, ${labelVariable}, ${outputsVariable}, ${interpolation}, ${JSON.stringify(interpolationType)}, ${interpolationCache})`;
    }

    serialize() {
        const result = ['curve'];
        const interp = [this.interpolation.name];
        if (this.interpolation.name === 'exponential') {
            interp.push(this.interpolation.base);
        } else if (this.interpolation.name === 'cubic-bezier') {
            interp.push.apply(interp, this.interpolation.controlPoints);
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

/**
 * Returns a ratio that can be used to interpolate between exponential function
 * stops.
 * How it works: Two consecutive stop values define a (scaled and shifted) exponential function `f(x) = a * base^x + b`, where `base` is the user-specified base,
 * and `a` and `b` are constants affording sufficient degrees of freedom to fit
 * the function to the given stops.
 *
 * Here's a bit of algebra that lets us compute `f(x)` directly from the stop
 * values without explicitly solving for `a` and `b`:
 *
 * First stop value: `f(x0) = y0 = a * base^x0 + b`
 * Second stop value: `f(x1) = y1 = a * base^x1 + b`
 * => `y1 - y0 = a(base^x1 - base^x0)`
 * => `a = (y1 - y0)/(base^x1 - base^x0)`
 *
 * Desired value: `f(x) = y = a * base^x + b`
 * => `f(x) = y0 + a * (base^x - base^x0)`
 *
 * From the above, we can replace the `a` in `a * (base^x - base^x0)` and do a
 * little algebra:
 * ```
 * a * (base^x - base^x0) = (y1 - y0)/(base^x1 - base^x0) * (base^x - base^x0)
 *                     = (y1 - y0) * (base^x - base^x0) / (base^x1 - base^x0)
 * ```
 *
 * If we let `(base^x - base^x0) / (base^x1 base^x0)`, then we have
 * `f(x) = y0 + (y1 - y0) * ratio`.  In other words, `ratio` may be treated as
 * an interpolation factor between the two stops' output values.
 *
 * (Note: a slightly different form for `ratio`,
 * `(base^(x-x0) - 1) / (base^(x1-x0) - 1) `, is equivalent, but requires fewer
 * expensive `Math.pow()` operations.)
 *
 * @private
*/
function exponentialInterpolation(input, base, lowerValue, upperValue, cache: {[number]: {[number]: number}}) {
    const difference = upperValue - lowerValue;
    const progress = input - lowerValue;

    if (difference === 0) {
        return 0;
    } else if (base === 1) {
        return progress / difference;
    } else {
        // only use memoized pow() for base^difference, because the cache is
        // naive and never evicts entries.  (base^progress would produce an
        // unbounded number of entries)
        return (Math.pow(base, progress) - 1) / (pow(base, difference, cache) - 1);
    }
}

// memoized Math.pow
function pow(base, exp, cache: {[number]: {[number]: number}}) {
    if (!cache.hasOwnProperty(base)) {
        cache[base] = {};
    }
    const c = cache[base];
    if (!c.hasOwnProperty(exp)) {
        c[exp] = Math.pow(base, exp);
    }
    return c[exp];
}

module.exports = Curve;
