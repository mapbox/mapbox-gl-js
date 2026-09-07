import * as colorSpaces from '../util/color_spaces';
import Color from '../util/color';
import {getType, isNumber} from '../util/get_type';
import * as interpolate from '../util/interpolate';
import Interpolate from '../expression/definitions/interpolate';
import Formatted from '../expression/types/formatted';
import ResolvedImage from '../expression/types/resolved_image';
import {supportsInterpolation} from '../util/properties';
import {findStopLessThanOrEqualTo} from '../expression/stops';

import type {InterpolationType} from '../expression/definitions/interpolate';
import type {StylePropertySpecification} from '../style-spec';
import type {
    FunctionSpecification,
    PropertyFunctionStop,
    SourceFunctionSpecification,
    ZoomAndPropertyFunctionStop
} from '../types';

type StopKey = ZoomAndPropertyFunctionStop<unknown>[0]['value'];
type CompositeStopInput = ZoomAndPropertyFunctionStop<unknown>[0];
type Stop = [StopKey | CompositeStopInput, unknown];
type CategoricalStop = Extract<SourceFunctionSpecification<unknown>, {type: 'categorical'}>['stops'][number];
type NumericStop = PropertyFunctionStop<unknown>;
type FunctionParameters = Pick<FunctionSpecification<unknown>, 'base' | 'property' | 'type' | 'default'> & {
    stops?: Stop[];
    colorSpace?: string;
};
type FeatureLike = {properties?: Record<string, unknown>};
type HashedStops = Record<string, unknown>;
type EvaluationArguments = [globals: {zoom: number} | number, feature?: FeatureLike | null];
type Evaluator = {evaluate: (...args: EvaluationArguments) => unknown};
type EvaluationFunction = (
    parameters: FunctionParameters,
    propertySpec: StylePropertySpecification,
    input: unknown,
    hashedStops?: HashedStops,
    categoricalKeyType?: string,
) => unknown;
type InterpolationFunction = (from: unknown, to: unknown, t: number) => unknown;
type ColorSpace = Record<'forward' | 'reverse', typeof identityFunction> & {interpolate: InterpolationFunction};

export function isFunction(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityFunction(x: unknown): unknown {
    return x;
}

export function createFunction(input: unknown, propertySpec: StylePropertySpecification) {
    let parameters = input as FunctionParameters;
    const isColor = propertySpec.type === 'color';
    const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0]![0] === 'object';
    const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
    const zoomDependent = zoomAndFeatureDependent || !featureDependent;
    const type = parameters.type || (supportsInterpolation(propertySpec) ? 'exponential' : 'interval');

    if (isColor) {
        parameters = {...parameters};

        if (parameters.stops) {
            parameters.stops = parameters.stops.map((stop) => {
                return [stop[0], Color.parse(stop[1] as string | Color | null)];
            });
        }

        if (parameters.default) {
            parameters.default = Color.parse(parameters.default as string | Color);
        } else {
            parameters.default = Color.parse(propertySpec.default);
        }
    }

    if (parameters.colorSpace && parameters.colorSpace !== 'rgb' && !colorSpaces[parameters.colorSpace as keyof typeof colorSpaces]) {
        throw new Error(`Unknown color space: ${parameters.colorSpace}`);
    }

    let innerFun: EvaluationFunction;
    let hashedStops: HashedStops | undefined;
    let categoricalKeyType: string | undefined;
    if (type === 'exponential') {
        innerFun = evaluateExponentialFunction;
    } else if (type === 'interval') {
        innerFun = evaluateIntervalFunction;
    } else if (type === 'categorical') {
        innerFun = evaluateCategoricalFunction;

        // For categorical functions, generate an Object as a hashmap of the stops for fast searching
        hashedStops = Object.create(null) as HashedStops;
        for (const stop of parameters.stops as CategoricalStop[]) {
            hashedStops[stop[0] as string | number] = stop[1];
        }

        // Infer key type based on first stop key-- used to encforce strict type checking later
        categoricalKeyType = typeof (parameters.stops as CategoricalStop[])[0]![0];

    } else if (type === 'identity') {
        innerFun = evaluateIdentityFunction;
    } else {
        throw new Error(`Unknown function type "${type}"`);
    }

    if (zoomAndFeatureDependent) {
        const featureFunctions: Record<string, FunctionParameters & {zoom: number; stops: Stop[]}> = {};
        const zoomStops: number[] = [];
        for (let s = 0; s < parameters.stops!.length; s++) {
            const stop = parameters.stops![s] as [CompositeStopInput, unknown];
            const zoom = stop[0].zoom;
            if (featureFunctions[zoom] === undefined) {
                featureFunctions[zoom] = {
                    zoom,
                    type: parameters.type,
                    property: parameters.property,
                    default: parameters.default,
                    stops: []
                };
                zoomStops.push(zoom);
            }
            featureFunctions[zoom].stops.push([stop[0].value, stop[1]]);
        }

        const featureFunctionStops: Array<[number, Evaluator]> = [];
        for (const z of zoomStops) {
            featureFunctionStops.push([featureFunctions[z]!.zoom, createFunction(featureFunctions[z]!, propertySpec) as Evaluator]);
        }

        const interpolationType: InterpolationType = {name: 'linear'};
        return {
            kind: 'composite',
            interpolationType,

            interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
            zoomStops: featureFunctionStops.map(s => s[0]),
            evaluate({zoom}: {zoom: number}, properties: FeatureLike | null | undefined) {
                return (evaluateExponentialFunction({
                    stops: featureFunctionStops,
                    base: parameters.base
                }, propertySpec, zoom) as Evaluator).evaluate(zoom, properties);
            }
        };
    } else if (zoomDependent) {
        const interpolationType: InterpolationType | null = type === 'exponential' ?
            {name: 'exponential', base: parameters.base !== undefined ? parameters.base : 1} : null;
        return {
            kind: 'camera',
            interpolationType,

            interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType as InterpolationType),
            zoomStops: parameters.stops!.map(s => s[0]),
            evaluate: ({zoom}: {zoom: number}) => innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType)
        };
    } else {
        return {
            kind: 'source',
            evaluate(_: unknown, feature: FeatureLike | null | undefined) {
                const value = feature && feature.properties ? feature.properties[parameters.property!] : undefined;
                if (value === undefined) {
                    return coalesce(parameters.default, propertySpec.default);
                }
                return innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType);
            }
        };
    }
}

function coalesce(a: unknown, b: unknown, c?: unknown): unknown {
    if (a !== undefined) return a;
    if (b !== undefined) return b;
    if (c !== undefined) return c;
}

function evaluateCategoricalFunction(
    parameters: FunctionParameters,
    propertySpec: StylePropertySpecification,
    input: unknown,
    hashedStops?: HashedStops,
    keyType?: string,
): unknown {
    const evaluated = typeof input === keyType ? hashedStops![input as string | number] : undefined; // Enforce strict typing on input
    return coalesce(evaluated, parameters.default, propertySpec.default);
}

function evaluateIntervalFunction(parameters: FunctionParameters, propertySpec: StylePropertySpecification, input: unknown): unknown {
    // Edge cases
    if (!isNumber(input)) return coalesce(parameters.default, propertySpec.default);
    const stops = parameters.stops as NumericStop[];
    const n = stops.length;
    if (n === 1) return stops[0]![1];
    if (input <= stops[0]![0]) return stops[0]![1];
    if (input >= stops[n - 1]![0]) return stops[n - 1]![1];

    const index = findStopLessThanOrEqualTo(stops.map((stop) => stop[0]), input);

    return stops[index]![1];
}

function evaluateExponentialFunction(parameters: FunctionParameters, propertySpec: StylePropertySpecification, input: unknown): unknown {
    const base = parameters.base !== undefined ? parameters.base : 1;

    // Edge cases
    if (!isNumber(input)) return coalesce(parameters.default, propertySpec.default);
    const stops = parameters.stops as NumericStop[];
    const n = stops.length;
    if (n === 1) return stops[0]![1];
    if (input <= stops[0]![0]) return stops[0]![1];
    if (input >= stops[n - 1]![0]) return stops[n - 1]![1];

    const index = findStopLessThanOrEqualTo(stops.map((stop) => stop[0]), input);
    const t = interpolationFactor(input, base, stops[index]![0], stops[index + 1]![0]);

    const outputLower = stops[index]![1];
    const outputUpper = stops[index + 1]![1];
    let interp = (interpolate[propertySpec.type as keyof typeof interpolate] as InterpolationFunction | undefined) || identityFunction;

    if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
        const colorspace = colorSpaces[parameters.colorSpace as keyof typeof colorSpaces] as ColorSpace;
        interp = (a, b) => colorspace.reverse(colorspace.interpolate(colorspace.forward(a), colorspace.forward(b), t));
    }

    if (typeof (outputLower as Partial<Evaluator>).evaluate === 'function') {
        return {
            evaluate(...args: EvaluationArguments) {
                const evaluatedLower = (outputLower as Evaluator).evaluate.apply(undefined, args);
                const evaluatedUpper = (outputUpper as Evaluator).evaluate.apply(undefined, args);
                // Special case for fill-outline-color, which has no spec default.
                if (evaluatedLower === undefined || evaluatedUpper === undefined) {
                    return undefined;
                }
                return interp(evaluatedLower, evaluatedUpper, t);
            }
        };
    }

    return interp(outputLower, outputUpper, t);
}

function evaluateIdentityFunction(parameters: FunctionParameters, propertySpec: StylePropertySpecification, input: unknown): unknown {
    if (propertySpec.type === 'color') {
        input = Color.parse(input as string | Color | null);
    } else if (propertySpec.type === 'formatted') {
        input = Formatted.fromString((input as {toString: () => string}).toString());
    } else if (propertySpec.type === 'resolvedImage') {
        input = ResolvedImage.build((input as {toString: () => string}).toString());
    } else if (getType(input) !== propertySpec.type && (propertySpec.type !== 'enum' || !propertySpec.values![input as keyof typeof propertySpec.values])) {
        input = undefined;
    }
    return coalesce(input, parameters.default, propertySpec.default);
}

/**
 * Returns a ratio that can be used to interpolate between exponential function
 * stops.
 *
 * How it works:
 * Two consecutive stop values define a (scaled and shifted) exponential
 * function `f(x) = a * base^x + b`, where `base` is the user-specified base,
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
function interpolationFactor(input: number, base: number, lowerValue: number, upperValue: number): number {
    const difference = upperValue - lowerValue;
    const progress = input - lowerValue;

    if (difference === 0) {
        return 0;
    } else if (base === 1) {
        return progress / difference;
    } else {
        return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }
}
