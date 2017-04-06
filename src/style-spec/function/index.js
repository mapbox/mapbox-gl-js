'use strict';

const colorSpaces = require('./color_spaces');
const parseColor = require('../util/parse_color');
const extend = require('../util/extend');
const getType = require('../util/get_type');

function identityFunction(x) {
    return x;
}

function createFunction(parameters, propertySpec) {
    const isColor = propertySpec.type === 'color';

    let fun;

    if (!isFunctionDefinition(parameters)) {
        if (isColor && parameters) {
            parameters = parseColor(parameters);
        }
        fun = function() {
            return parameters;
        };
        fun.isFeatureConstant = true;
        fun.isZoomConstant = true;

    } else {
        const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
        const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
        const zoomDependent = zoomAndFeatureDependent || !featureDependent;
        const type = parameters.type || (propertySpec.function === 'interpolated' ? 'exponential' : 'interval');

        if (isColor) {
            parameters = extend({}, parameters);

            if (parameters.stops) {
                parameters.stops = parameters.stops.map((stop) => {
                    return [stop[0], parseColor(stop[1])];
                });
            }

            if (parameters.default) {
                parameters.default = parseColor(parameters.default);
            } else {
                parameters.default = parseColor(propertySpec.default);
            }
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
            hashedStops = Object.create(null);
            for (const stop of parameters.stops) {
                hashedStops[stop[0]] = stop[1];
            }

            // Infer key type based on first stop key-- used to encforce strict type checking later
            categoricalKeyType = typeof parameters.stops[0][0];

        } else if (type === 'identity') {
            innerFun = evaluateIdentityFunction;
        } else {
            throw new Error(`Unknown function type "${type}"`);
        }

        let outputFunction;

        // If we're interpolating colors in a color system other than RGBA,
        // first translate all stop values to that color system, then interpolate
        // arrays as usual. The `outputFunction` option lets us then translate
        // the result of that interpolation back into RGBA.
        if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
            if (colorSpaces[parameters.colorSpace]) {
                const colorspace = colorSpaces[parameters.colorSpace];
                // Avoid mutating the parameters value
                parameters = JSON.parse(JSON.stringify(parameters));
                for (let s = 0; s < parameters.stops.length; s++) {
                    parameters.stops[s] = [
                        parameters.stops[s][0],
                        colorspace.forward(parameters.stops[s][1])
                    ];
                }
                outputFunction = colorspace.reverse;
            } else {
                throw new Error(`Unknown color space: ${parameters.colorSpace}`);
            }
        } else {
            outputFunction = identityFunction;
        }

        if (zoomAndFeatureDependent) {
            const featureFunctions = {};
            const zoomStops = [];
            for (let s = 0; s < parameters.stops.length; s++) {
                const stop = parameters.stops[s];
                const zoom = stop[0].zoom;
                if (featureFunctions[zoom] === undefined) {
                    featureFunctions[zoom] = {
                        zoom: zoom,
                        type: parameters.type,
                        property: parameters.property,
                        stops: []
                    };
                    zoomStops.push(zoom);
                }
                featureFunctions[zoom].stops.push([stop[0].value, stop[1]]);
            }

            const featureFunctionStops = [];
            for (const z of zoomStops) {
                featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z], propertySpec)]);
            }
            fun = function(zoom, feature) {
                return outputFunction(evaluateExponentialFunction({
                    stops: featureFunctionStops,
                    base: parameters.base
                }, propertySpec, zoom)(zoom, feature));
            };
            fun.isFeatureConstant = false;
            fun.isZoomConstant = false;

        } else if (zoomDependent) {
            fun = function(zoom) {
                return outputFunction(innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType));
            };
            fun.isFeatureConstant = true;
            fun.isZoomConstant = false;
        } else {
            fun = function(zoom, feature) {
                const value = feature[parameters.property];
                if (value === undefined) {
                    return coalesce(parameters.default, propertySpec.default);
                }
                return outputFunction(innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType));
            };
            fun.isFeatureConstant = false;
            fun.isZoomConstant = true;
        }
    }

    return fun;
}

function coalesce(a, b, c) {
    if (a !== undefined) return a;
    if (b !== undefined) return b;
    if (c !== undefined) return c;
}

function evaluateCategoricalFunction(parameters, propertySpec, input, hashedStops, keyType) {
    const evaluated = typeof input === keyType ? hashedStops[input] : undefined; // Enforce strict typing on input
    return coalesce(evaluated, parameters.default, propertySpec.default);
}

function evaluateIntervalFunction(parameters, propertySpec, input) {
    // Edge cases
    if (getType(input) !== 'number') return coalesce(parameters.default, propertySpec.default);
    const n = parameters.stops.length;
    if (n === 1) return parameters.stops[0][1];
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    const index = findStopLessThanOrEqualTo(parameters.stops, input);

    return parameters.stops[index][1];
}

function evaluateExponentialFunction(parameters, propertySpec, input) {
    const base = parameters.base !== undefined ? parameters.base : 1;

    // Edge cases
    if (getType(input) !== 'number') return coalesce(parameters.default, propertySpec.default);
    const n = parameters.stops.length;
    if (n === 1) return parameters.stops[0][1];
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    const index = findStopLessThanOrEqualTo(parameters.stops, input);

    return interpolate(
            input,
            base,
            parameters.stops[index][0],
            parameters.stops[index + 1][0],
            parameters.stops[index][1],
            parameters.stops[index + 1][1]
    );
}

function evaluateIdentityFunction(parameters, propertySpec, input) {
    if (propertySpec.type === 'color') {
        input = parseColor(input);
    } else if (getType(input) !== propertySpec.type) {
        input = undefined;
    }
    return coalesce(input, parameters.default, propertySpec.default);
}

/**
 * Returns the index of the last stop <= input, or 0 if it doesn't exist.
 *
 * @private
 */
function findStopLessThanOrEqualTo(stops, input) {
    const n = stops.length;
    let lowerIndex = 0;
    let upperIndex = n - 1;
    let currentIndex = 0;
    let currentValue, upperValue;

    while (lowerIndex <= upperIndex) {
        currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
        currentValue = stops[currentIndex][0];
        upperValue = stops[currentIndex + 1][0];
        if (input === currentValue || input > currentValue && input < upperValue) { // Search complete
            return currentIndex;
        } else if (currentValue < input) {
            lowerIndex = currentIndex + 1;
        } else if (currentValue > input) {
            upperIndex = currentIndex - 1;
        }
    }

    return Math.max(currentIndex - 1, 0);
}

function interpolate(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    if (typeof outputLower === 'function') {
        return function() {
            const evaluatedLower = outputLower.apply(undefined, arguments);
            const evaluatedUpper = outputUpper.apply(undefined, arguments);
            // Special case for fill-outline-color, which has no spec default.
            if (evaluatedLower === undefined || evaluatedUpper === undefined) {
                return undefined;
            }
            return interpolate(input, base, inputLower, inputUpper, evaluatedLower, evaluatedUpper);
        };
    } else if (outputLower.length) {
        return interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper);
    } else {
        return interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper);
    }
}

function interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    const ratio = interpolationFactor(input, base, inputLower, inputUpper);
    return outputLower + ratio * (outputUpper - outputLower);
}

function interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    const output = [];
    for (let i = 0; i < outputLower.length; i++) {
        output[i] = interpolateNumber(input, base, inputLower, inputUpper, outputLower[i], outputUpper[i]);
    }
    return output;
}

function isFunctionDefinition(value) {
    return typeof value === 'object' && (value.stops || value.type === 'identity');
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

    if (base === 1) {
        return progress / difference;
    } else {
        return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }
}

module.exports = createFunction;
module.exports.isFunctionDefinition = isFunctionDefinition;
module.exports.interpolationFactor = interpolationFactor;
module.exports.findStopLessThanOrEqualTo = findStopLessThanOrEqualTo;
