// @flow

const parseColor = require('../util/parse_color');
const interpolate = require('../util/interpolate');
const interpolationFactor = require('./interpolation_factor');
const {Color, typeOf} = require('./values');

import type { Value } from './values';
import type { InterpolationType } from './definitions/curve';

class RuntimeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ExpressionEvaluationError';
        this.message = message;
    }

    toJSON() {
        return `${this.message}`;
    }
}

// don't call this 'assert' because build/min.test.js checks for 'assert('
// in the bundled code to verify that unassertify is working.
function ensure(condition: any, message: string) {
    if (!condition) throw new RuntimeError(message);
    return true;
}

module.exports = () => ({
    ensure: ensure,
    error: (msg: string) => ensure(false, msg),

    at: function (index: number, array: Array<Value>) {
        ensure(index < array.length, `Array index out of bounds: ${index} > ${array.length}.`);
        return array[index];
    },

    get: function (obj: {[string]: Value}, key: string, name?: string) {
        ensure(this.has(obj, key, name), `Property '${key}' not found in ${name || `object with keys: [${Object.keys(obj).join(', ')}]`}`);
        return obj[key];
    },

    has: function (obj: {[string]: Value}, key: string, name?: string) {
        ensure(obj, `Cannot get property ${key} from null object${name ? ` ${name}` : ''}.`);
        return this.as(obj, 'Object', name).hasOwnProperty(key);
    },

    typeOf: function (x: Value): string {
        return typeOf(x).name;
    },

    // type assertion
    as: function (value: Value, expectedType: string, name?: string) {
        const type = this.typeOf(value);
        if (expectedType === 'Array') {
            ensure(/Array(<(string|number|boolean)>)?/.test(type),
                `Expected ${name || 'value'} to be an Array, but found ${type} instead.`);
        } else {
            ensure(type === expectedType, `Expected ${name || 'value'} to be of type ${expectedType}, but found ${type} instead.`);
        }
        return value;
    },

    coalesce: function (...thunks: Array<Function>) {
        while (true) {
            try {
                if (thunks.length === 0) return null;
                const result = (thunks.shift())();
                if (result !== null) return result;
            } catch (e) {
                if (thunks.length === 0) throw e;
            }
        }
    },

    parseColor: function (input: string) {
        const c = parseColor(input);
        if (!c)
            throw new RuntimeError(`Could not parse color from value '${input}'`);
        return new Color(...c);
    },

    rgba: function (r: number, g: number, b: number, a?: number) {
        return new Color(r / 255, g / 255, b / 255, a);
    },

    toString: function(value: Value) {
        const type = this.typeOf(value);
        ensure(value === null || /^(String|Number|Boolean)$/.test(type), `Expected a primitive value in ["string", ...], but found ${type} instead.`);
        return String(value);
    },

    toNumber: function(value: Value) {
        const num = Number(value);
        ensure(!isNaN(num), `Could not convert ${JSON.stringify(this.unwrap(value))} to number.`);
        return num;
    },

    unwrap: function (maybeWrapped: Value) {
        if (maybeWrapped instanceof Color) {
            return maybeWrapped.value;
        }

        return maybeWrapped;
    },

    evaluateCurve(input: number, stopInputs: Array<number>, stopOutputs: Array<Function>, interpolation: InterpolationType, resultType: string) {
        input = this.as(input, 'Number', 'curve input');

        const stopCount = stopInputs.length;
        if (stopInputs.length === 1) return stopOutputs[0]();
        if (input <= stopInputs[0]) return stopOutputs[0]();
        if (input >= stopInputs[stopCount - 1]) return stopOutputs[stopCount - 1]();

        const index = findStopLessThanOrEqualTo(stopInputs, input);

        if (interpolation.name === 'step') {
            return stopOutputs[index]();
        }

        let base = 1;
        if (interpolation.name === 'exponential') {
            base = interpolation.base;
        }
        const t = interpolationFactor(input, base, stopInputs[index], stopInputs[index + 1]);

        const outputLower = stopOutputs[index]();
        const outputUpper = stopOutputs[index + 1]();

        if (resultType === 'color') {
            return new Color(...interpolate.color(outputLower.value, outputUpper.value, t));
        }

        if (resultType === 'array') {
            return interpolate.array(outputLower, outputUpper, t);
        }

        return interpolate[resultType](outputLower, outputUpper, t);
    }
});

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
        currentValue = stops[currentIndex];
        upperValue = stops[currentIndex + 1];
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

