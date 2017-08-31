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

import type {ParsingContext} from './expression';
import type {Type} from './types';

/**
 * Returns null if the type matches, or an error message if not.
 *
 * If `context` is provided, then also push the error to it via
 * `context.error()`
 *
 * @private
 */
function checkSubtype(
    expected: Type,
    t: Type,
    context?: ParsingContext
): ?string {
    const error = `Expected ${toString(expected)} but found ${toString(t)} instead.`;

    // Error is a subtype of every type
    if (t.kind === 'Error') {
        return null;
    }

    if (expected.kind === 'Value') {
        if (t.kind === 'Value') return null;
        const members = [
            NullType,
            NumberType,
            StringType,
            BooleanType,
            ColorType,
            ObjectType,
            array(ValueType)
        ];

        for (const memberType of members) {
            if (!checkSubtype(memberType, t)) {
                return null;
            }
        }

        if (context) context.error(error);
        return error;
    } else if (expected.kind === 'Array') {
        if (t.kind === 'Array') {
            const itemError = checkSubtype(expected.itemType, t.itemType);
            if (itemError) {
                if (context) context.error(error);
                return error;
            } else if (typeof expected.N === 'number' && expected.N !== t.N) {
                if (context) context.error(error);
                return error;
            } else {
                return null;
            }
        } else {
            if (context) context.error(error);
            return error;
        }
    } else {
        if (t.kind === expected.kind) return null;
        if (context) context.error(error);
        return error;
    }
}

module.exports = checkSubtype;
