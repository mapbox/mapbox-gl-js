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

    toColor: function (input: Value) {
        if (typeof input === 'string') {
            return this.parseColor(input);
        } else if (Array.isArray(input) && (input.length === 3 || input.length === 4)) {
            return this.rgba(...input);
        } else {
            throw new RuntimeError(`Could not parse color from value '${JSON.stringify(input)}'`);
        }
    },

    _parseColorCache: ({}: {[string]: Color}),
    parseColor: function (input: string) {
        let cached = this._parseColorCache[input];
        if (!cached) {
            const c = parseColor(input);
            if (!c)
                throw new RuntimeError(`Could not parse color from value '${input}'`);
            cached = this._parseColorCache[input] = new Color(...c);
        }
        return cached;
    },

    rgba: function (r: number, g: number, b: number, a?: number) {
        ensure(r >= 0 && r <= 255 &&
            g >= 0 && g <= 255 &&
            b >= 0 && b <= 255, `Invalid rgba value [${[r, g, b, a || 1].join(', ')}]: 'r', 'g', and 'b' must be between 0 and 255.`);
        ensure(typeof a === 'undefined' ||
            (a >= 0 && a <= 1), `Invalid rgba value [${[r, g, b, a || 1].join(', ')}]: 'a' must be between 0 and 1.`);
        return new Color(r / 255, g / 255, b / 255, a);
    },

    toString: function(value: Value) {
        const type = this.typeOf(value);
        ensure(value === null || /^(String|Number|Boolean)$/.test(type), `Expected a primitive value in ["string", ...], but found ${type} instead.`);
        return String(value);
    },

    toNumber: function(value: Value) {
        const num = Number(value);
        ensure(value !== null && !isNaN(num), `Could not convert ${JSON.stringify(this.unwrap(value))} to number.`);
        return num;
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

