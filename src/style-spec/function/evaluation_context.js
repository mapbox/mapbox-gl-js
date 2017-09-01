// @flow

const assert = require('assert');
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
    toString} = require('./types');
const {Color, typeOf, isValue} = require('./values');
const checkSubtype = require('./check_subtype');
const Curve = require('./definitions/curve');

import type UnitBezier from '@mapbox/unitbezier';
import type { Type } from './types';
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
    Number: 'number',
    String: 'string',
    Boolean: 'boolean',
    Object: 'object'
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

    get: function (obj: {[string]: Value}, key: string, name?: string) {
        ensure(this.has(obj, key, name), `Property '${key}' not found in ${name || `object`}`);
        return obj[key];
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

    as: function (value: Value, expectedType: Type, name?: string) {
        assert(isValue(value), `Invalid value ${JSON.stringify(value)}`);
        assert(expectedType.kind, `Invalid type ${JSON.stringify(expectedType)}`);

        let type;
        let typeError = false;
        if (expectedType.kind === 'Null') {
            typeError = value === null;
        } else if (expectedType.kind === 'Value') {
            typeError = false;
        } else if (expectedType.kind !== 'Array' && expectedType.kind !== 'Color' && expectedType.kind !== 'Error') {
            typeError = typeof value !== jsTypes[expectedType.kind];
        } else {
            type = typeOf(value);
            typeError = checkSubtype(expectedType, type);
        }

        if (typeError) {
            if (!type) type = typeOf(value);
            throw new RuntimeError(`Expected ${name || 'value'} to be of type ${toString(expectedType)}, but found ${toString(type)} instead.`);
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

    _unitBezierCache: ({}: {[string]: UnitBezier}),
    evaluateCurve(input: number, stopInputs: Array<number>, stopOutputs: Array<any>, interpolation: InterpolationType, resultType: string) {
        const stopCount = stopInputs.length;
        if (stopInputs.length === 1) return stopOutputs[0];
        if (input <= stopInputs[0]) return stopOutputs[0];
        if (input >= stopInputs[stopCount - 1]) return stopOutputs[stopCount - 1];

        const index = findStopLessThanOrEqualTo(stopInputs, input);

        if (interpolation.name === 'step') {
            return stopOutputs[index];
        }

        const lower = stopInputs[index];
        const upper = stopInputs[index + 1];
        const t = Curve.interpolationFactor(interpolation, input, lower, upper, this._unitBezierCache);

        const outputLower = stopOutputs[index];
        const outputUpper = stopOutputs[index + 1];

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

