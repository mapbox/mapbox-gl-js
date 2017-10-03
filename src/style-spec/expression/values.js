// @flow

const assert = require('assert');

const {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    array
} = require('./types');

import type { Type } from './types';

class Color {
    value: [number, number, number, number];
    constructor(r: number, g: number, b: number, a: number = 1) {
        this.value = [r, g, b, a];
    }
}

export type Value = null | string | boolean | number | Color | Array<Value> | { [string]: Value }

function isValue(mixed: mixed): boolean {
    if (mixed === null) {
        return true;
    } else if (typeof mixed === 'string') {
        return true;
    } else if (typeof mixed === 'boolean') {
        return true;
    } else if (typeof mixed === 'number') {
        return true;
    } else if (mixed instanceof Color) {
        return true;
    } else if (Array.isArray(mixed)) {
        for (const item of mixed) {
            if (!isValue(item)) {
                return false;
            }
        }
        return true;
    } else if (typeof mixed === 'object') {
        for (const key in mixed) {
            if (!isValue(mixed[key])) {
                return false;
            }
        }
        return true;
    } else {
        return false;
    }
}

function typeOf(value: Value): Type {
    if (value === null) {
        return NullType;
    } else if (typeof value === 'string') {
        return StringType;
    } else if (typeof value === 'boolean') {
        return BooleanType;
    } else if (typeof value === 'number') {
        return NumberType;
    } else if (value instanceof Color) {
        return ColorType;
    } else if (Array.isArray(value)) {
        const length = value.length;
        let itemType: ?Type;

        for (const item of value) {
            const t = typeOf(item);
            if (!itemType) {
                itemType = t;
            } else if (itemType === t) {
                continue;
            } else {
                itemType = ValueType;
                break;
            }
        }

        return array(itemType || ValueType, length);
    } else {
        assert(typeof value === 'object');
        return ObjectType;
    }
}

function unwrap(value: Value): mixed {
    return value instanceof Color ? value.value : value;
}

module.exports = {
    Color,
    isValue,
    typeOf,
    unwrap
};
