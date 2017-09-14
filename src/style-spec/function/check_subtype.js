// @flow

const {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ObjectType,
    ColorType,
    ValueType,
    array,
    toString
} = require('./types');

import type {Type} from './types';

const valueMemberTypes = [
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    array(ValueType)
];

/**
 * Returns null if `t` is a subtype of `expected`; otherwise returns an
 * error message.
 * * @private
 */
function checkSubtype(expected: Type, t: Type): ?string {
    if (t.kind === 'Error') {
        // Error is a subtype of every type
        return null;
    } else if (expected.kind === 'Array') {
        if (t.kind === 'Array' &&
            !checkSubtype(expected.itemType, t.itemType) &&
            (typeof expected.N !== 'number' || expected.N === t.N)) {
            return null;
        }
    } else if (expected.kind === t.kind) {
        return null;
    } else if (expected.kind === 'Value') {
        for (const memberType of valueMemberTypes) {
            if (!checkSubtype(memberType, t)) {
                return null;
            }
        }
    }

    return `Expected ${toString(expected)} but found ${toString(t)} instead.`;
}

module.exports = checkSubtype;
