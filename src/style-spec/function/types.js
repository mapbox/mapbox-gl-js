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
    toString
};
