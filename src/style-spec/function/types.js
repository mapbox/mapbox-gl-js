// @flow

export type NullTypeT = { kind: 'Null' };
export type NumberTypeT = { kind: 'Number' };
export type StringTypeT = { kind: 'String' };
export type BooleanTypeT = { kind: 'Boolean' };
export type ColorTypeT = { kind: 'Color' };
export type ObjectTypeT = { kind: 'Object' };
export type ValueTypeT = { kind: 'Value' };
export type ErrorTypeT = { kind: 'Error' };

export type Type =
    NullTypeT |
    NumberTypeT |
    StringTypeT |
    BooleanTypeT |
    ColorTypeT |
    ObjectTypeT |
    ValueTypeT |
    ArrayType | // eslint-disable-line no-use-before-define
    ErrorTypeT

export type ArrayType = {
    kind: 'Array',
    itemType: Type,
    N: ?number
}

const NullType = { kind: 'Null' };
const NumberType = { kind: 'Number' };
const StringType = { kind: 'String' };
const BooleanType = { kind: 'Boolean' };
const ColorType = { kind: 'Color' };
const ObjectType = { kind: 'Object' };
const ValueType = { kind: 'Value' };
const ErrorType = { kind: 'Error' };

function array(itemType: Type, N: ?number): ArrayType {
    return {
        kind: 'Array',
        itemType,
        N
    };
}

function toString(type: Type): string {
    if (type.kind === 'Array') {
        const itemType = toString(type.itemType);
        return typeof type.N === 'number' ?
            `Array<${itemType}, ${type.N}>` :
            type.itemType.kind === 'Value' ? 'Array' : `Array<${itemType}>`;
    } else {
        return type.kind;
    }
}

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

module.exports = {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    array,
    ErrorType,
    toString,
    checkSubtype
};
