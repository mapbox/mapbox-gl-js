// @flow

const parseColor = require('../util/parse_color');
const interpolate = require('../util/interpolate');
const {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    toString,
    checkSubtype} = require('./types');
const {Color, typeOf} = require('./values');
const Curve = require('./definitions/curve');

import type { ArrayType } from './types';
import type { Value } from './values';
import type { InterpolationType } from './definitions/curve';
import type { Feature } from './index';

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];
const types = {
    Null: NullType,
    Number: NumberType,
    String: StringType,
    Boolean: BooleanType,
    Color: ColorType,
    Object: ObjectType,
    Value: ValueType
};

const jsTypes = {
    number: NumberType,
    string: StringType,
    boolean: BooleanType,
    object: ObjectType
};

class RuntimeError {
    name: string;
    message: string;
    constructor(message) {
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
    types: types,

    ensure: ensure,
    error: (msg: string) => ensure(false, msg),

    at: function (index: number, array: Array<Value>) {
        ensure(index >= 0 && index < array.length,
            `Array index out of bounds: ${index} > ${array.length}.`);
        ensure(index === Math.floor(index),
            `Array index must be an integer, but found ${String(index)} instead.`);
        return array[index];
    },

    get: function (obj: {[string]: Value}, key: string) {
        const v = obj[key];
        return typeof v === 'undefined' ? null : v;
    },

    has: function (obj: {[string]: Value}, key: string, name?: string) {
        ensure(obj, `Cannot get property ${key} from null object${name ? ` ${name}` : ''}.`);
        ensure(typeof obj === 'object', `Expected ${name || 'value'} to be of type Object, but found ${toString(typeOf(obj))} instead.`);
        return typeof obj[key] !== 'undefined';
    },

    contains: function (value: Value, array: Array<Value>) {
        const type = typeOf(value).kind;
        ensure(type !== 'Object' && type !== 'Array' && type !== 'Color',
            `"contains" does not support values of type ${type}`);
        return array.indexOf(value) >= 0;
    },

    typeOf: function (x: Value): string {
        return toString(typeOf(x));
    },

    asJSType: function (expectedType: string, values: Array<Function>) {
        let value;
        for (let i = 0; i < values.length; i++) {
            value = values[i]();
            if (typeof value === expectedType && value !== null) {
                return value;
            }
        }
        const expected = jsTypes[expectedType].kind;
        throw new RuntimeError(`Expected value to be of type ${expected}, but found ${this.typeOf(value)} instead.`);
    },

    asArray: function (value: Value, expectedType: ArrayType) {
        const type = typeOf(value);
        const typeError = checkSubtype(expectedType, type);

        if (typeError) {
            throw new RuntimeError(`Expected value to be of type ${toString(expectedType)}, but found ${toString(type)} instead.`);
        }

        return value;
    },

    toColor: function (args: Array<()=>any>) {
        let input;
        let error;
        for (let i = 0; i < args.length; i++) {
            input = args[i]();
            error = null;
            if (typeof input === 'string') {
                const c = this._parseColor(input);
                if (c) return c;
            } else if (Array.isArray(input)) {
                error = this._validateRGBA(input[0], input[1], input[2], input[3]);
                if (!error) return new Color(input[0] / 255, input[1] / 255, input[2] / 255, input[3]);
            }
        }
        throw new RuntimeError(error || `Could not parse color from value '${typeof input === 'string' ? input : JSON.stringify(input)}'`);
    },

    _parseColorCache: ({}: {[string]: ?Color}),
    _parseColor: function (input: string): ?Color {
        let cached = this._parseColorCache[input];
        if (!cached) {
            const c = parseColor(input);
            cached = this._parseColorCache[input] = c ? new Color(c[0], c[1], c[2], c[3]) : null;
        }
        return cached;
    },

    rgba: function (r: number, g: number, b: number, a?: number) {
        const error = this._validateRGBA(r, g, b, a);
        if (error) throw new RuntimeError(error);
        return new Color(r / 255, g / 255, b / 255, a);
    },

    _validateRGBA(r: number, g: number, b: number, a?: number): ?string {
        if (!(
            typeof r === 'number' && r >= 0 && r <= 255 &&
            typeof g === 'number' && g >= 0 && g <= 255 &&
            typeof b === 'number' && b >= 0 && b <= 255
        )) {
            const value = typeof a === 'number' ? [r, g, b, a] : [r, g, b];
            return `Invalid rgba value [${value.join(', ')}]: 'r', 'g', and 'b' must be between 0 and 255.`;
        }

        if (!(
            typeof a === 'undefined' || (a >= 0 && a <= 1)
        )) {
            return `Invalid rgba value [${[r, g, b, a].join(', ')}]: 'a' must be between 0 and 1.`;
        }

        return null;
    },

    toString: function(value: Value) {
        const type = typeof value;
        if (value === null || type === 'string' || type === 'number' || type === 'boolean') {
            return String(value);
        } else if (value instanceof Color) {
            const [r, g, b, a] = value.value;
            return `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
        } else {
            return JSON.stringify(value);
        }
    },

    toNumber: function(args: Array<()=>Value>) {
        let value;
        for (let i = 0; i < args.length; i++) {
            value = args[i]();
            if (value === null) continue;
            const num = Number(value);
            if (isNaN(num)) continue;
            return num;
        }
        throw new RuntimeError(`Could not convert ${JSON.stringify(this.unwrap(value))} to number.`);
    },

    geometryType: function(feature: Feature) {
        return typeof feature.type === 'number' ?
            geometryTypes[feature.type] : feature.type;
    },

    unwrap: function (maybeWrapped: Value) {
        if (maybeWrapped instanceof Color) {
            return maybeWrapped.value;
        }

        return maybeWrapped;
    },

    evaluateCurve(input: number, stopInputs: Array<number>, stopOutputs: Array<any>, interpolation: InterpolationType, resultType: string) {
        const stopCount = stopInputs.length;
        if (stopInputs.length === 1) return stopOutputs[0]();
        if (input <= stopInputs[0]) return stopOutputs[0]();
        if (input >= stopInputs[stopCount - 1]) return stopOutputs[stopCount - 1]();

        const index = findStopLessThanOrEqualTo(stopInputs, input);

        if (interpolation.name === 'step') {
            return stopOutputs[index]();
        }

        const lower = stopInputs[index];
        const upper = stopInputs[index + 1];
        const t = Curve.interpolationFactor(interpolation, input, lower, upper);

        const outputLower = stopOutputs[index]();
        const outputUpper = stopOutputs[index + 1]();

        if (resultType === 'color') {
            return new Color(...interpolate.color(outputLower.value, outputUpper.value, t));
        }

        if (resultType === 'array') {
            return interpolate.array(outputLower, outputUpper, t);
        }

        return interpolate[resultType](outputLower, outputUpper, t);
    },

    coalesce(args: Array<Function>) {
        for (let i = 0; i < args.length - 1; i++) {
            const result = args[i]();
            if (result !== null) return result;
        }

        return args[args.length - 1]();
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

