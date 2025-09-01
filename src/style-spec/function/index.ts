/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import * as colorSpaces from '../util/color_spaces';
import Color from '../util/color';
import {getType, isNumber} from '../util/get_type';
import * as interpolate from '../util/interpolate';
import Interpolate from '../expression/definitions/interpolate';
import Formatted from '../expression/types/formatted';
import ResolvedImage from '../expression/types/resolved_image';
import {supportsInterpolation} from '../util/properties';
import {findStopLessThanOrEqualTo} from '../expression/stops';

export function isFunction(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityFunction(x) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return x;
}

export function createFunction(parameters, propertySpec) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isColor = propertySpec.type === 'color';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
    const zoomDependent = zoomAndFeatureDependent || !featureDependent;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    const type = parameters.type || (supportsInterpolation(propertySpec) ? 'exponential' : 'interval');

    if (isColor) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        parameters = Object.assign({}, parameters);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (parameters.stops) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            parameters.stops = parameters.stops.map((stop) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                return [stop[0], Color.parse(stop[1])];
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (parameters.default) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            parameters.default = Color.parse(parameters.default);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            parameters.default = Color.parse(propertySpec.default);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (parameters.colorSpace && parameters.colorSpace !== 'rgb' && !colorSpaces[parameters.colorSpace]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`Unknown color space: ${parameters.colorSpace}`);
    }

    let innerFun;
    let hashedStops;
    let categoricalKeyType;
    if (type === 'exponential') {
        innerFun = evaluateExponentialFunction;
    } else if (type === 'interval') {
        innerFun = evaluateIntervalFunction;
    } else if (type === 'categorical') {
        innerFun = evaluateCategoricalFunction;

        // For categorical functions, generate an Object as a hashmap of the stops for fast searching
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        hashedStops = Object.create(null);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const stop of parameters.stops) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            hashedStops[stop[0]] = stop[1];
        }

        // Infer key type based on first stop key-- used to encforce strict type checking later
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        categoricalKeyType = typeof parameters.stops[0][0];

    } else if (type === 'identity') {
        innerFun = evaluateIdentityFunction;
    } else {
        throw new Error(`Unknown function type "${type}"`);
    }

    if (zoomAndFeatureDependent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const featureFunctions: Record<string, any> = {};
        const zoomStops = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (let s = 0; s < parameters.stops.length; s++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const stop = parameters.stops[s];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const zoom = stop[0].zoom;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (featureFunctions[zoom] === undefined) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                featureFunctions[zoom] = {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    zoom,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    type: parameters.type,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    property: parameters.property,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    default: parameters.default,
                    stops: []
                };
                zoomStops.push(zoom);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            featureFunctions[zoom].stops.push([stop[0].value, stop[1]]);
        }

        const featureFunctionStops = [];
        for (const z of zoomStops) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z], propertySpec)]);
        }

        const interpolationType = {name: 'linear'};
        return {
            kind: 'composite',
            interpolationType,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
            zoomStops: featureFunctionStops.map(s => s[0]),
            evaluate({zoom}, properties) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
                return evaluateExponentialFunction({
                    stops: featureFunctionStops,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    base: parameters.base
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                }, propertySpec, zoom).evaluate(zoom, properties);
            }
        };
    } else if (zoomDependent) {
        const interpolationType = type === 'exponential' ?
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            {name: 'exponential', base: parameters.base !== undefined ? parameters.base : 1} : null;
        return {
            kind: 'camera',
            interpolationType,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            zoomStops: parameters.stops.map(s => s[0]),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            evaluate: ({zoom}) => innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType)
        };
    } else {
        return {
            kind: 'source',
            evaluate(_, feature) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const value = feature && feature.properties ? feature.properties[parameters.property] : undefined;
                if (value === undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
                    return coalesce(parameters.default, propertySpec.default);
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
                return innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType);
            }
        };
    }
}

function coalesce(a, b, c) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (a !== undefined) return a;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (b !== undefined) return b;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (c !== undefined) return c;
}

function evaluateCategoricalFunction(parameters, propertySpec, input, hashedStops, keyType) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const evaluated = typeof input === keyType ? hashedStops[input] : undefined; // Enforce strict typing on input
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return coalesce(evaluated, parameters.default, propertySpec.default);
}

function evaluateIntervalFunction(parameters, propertySpec, input) {
    // Edge cases
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (!isNumber(input)) return coalesce(parameters.default, propertySpec.default);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const n = parameters.stops.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (n === 1) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const index = findStopLessThanOrEqualTo(parameters.stops.map((stop) => stop[0]), input);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return parameters.stops[index][1];
}

function evaluateExponentialFunction(parameters, propertySpec, input) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const base = parameters.base !== undefined ? parameters.base : 1;

    // Edge cases
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (!isNumber(input)) return coalesce(parameters.default, propertySpec.default);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const n = parameters.stops.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (n === 1) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const index = findStopLessThanOrEqualTo(parameters.stops.map((stop) => stop[0]), input);
    const t = interpolationFactor(
        input, base,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        parameters.stops[index][0],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        parameters.stops[index + 1][0]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const outputLower = parameters.stops[index][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const outputUpper = parameters.stops[index + 1][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let interp = interpolate[propertySpec.type] || identityFunction;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const colorspace = colorSpaces[parameters.colorSpace];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        interp = (a, b) => colorspace.reverse(colorspace.interpolate(colorspace.forward(a), colorspace.forward(b), t));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof outputLower.evaluate === 'function') {
        return {
            evaluate(...args) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const evaluatedLower = outputLower.evaluate.apply(undefined, args);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const evaluatedUpper = outputUpper.evaluate.apply(undefined, args);
                // Special case for fill-outline-color, which has no spec default.
                if (evaluatedLower === undefined || evaluatedUpper === undefined) {
                    return undefined;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
                return interp(evaluatedLower, evaluatedUpper, t);
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return interp(outputLower, outputUpper, t);
}

function evaluateIdentityFunction(parameters, propertySpec, input) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (propertySpec.type === 'color') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        input = Color.parse(input);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (propertySpec.type === 'formatted') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        input = Formatted.fromString(input.toString());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (propertySpec.type === 'resolvedImage') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        input = ResolvedImage.build(input.toString());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (getType(input) !== propertySpec.type && (propertySpec.type !== 'enum' || !propertySpec.values[input])) {
        input = undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
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
function interpolationFactor(input, base, lowerValue, upperValue) {
    const difference = upperValue - lowerValue;
    const progress = input - lowerValue;

    if (difference === 0) {
        return 0;
    } else if (base === 1) {
        return progress / difference;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }
}
