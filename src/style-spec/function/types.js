// @flow

export type Type = PrimitiveType | ArrayType // eslint-disable-line no-use-before-define

export type PrimitiveType = { kind: 'primitive', name: string }
export type ArrayType = { kind: 'array', name: string, itemType: Type, N: ?number }

const NullType = primitive('Null');
const NumberType = primitive('Number');
const StringType = primitive('String');
const BooleanType = primitive('Boolean');
const ColorType = primitive('Color');
const ObjectType = primitive('Object');
const ValueType = primitive('Value');

function primitive(name) : PrimitiveType {
    return { kind: 'primitive', name };
}

function array(itemType: Type, N: ?number) : ArrayType {
    return {
        kind: 'array',
        name: typeof N === 'number' ? `Array<${itemType.name}, ${N}>` : itemType === ValueType ? 'Array' : `Array<${itemType.name}>`,
        itemType,
        N
    };
}

module.exports = {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    array
};
