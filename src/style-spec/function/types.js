// @flow

export type Type = PrimitiveType | TypeName | VariantType | ArrayType | NArgs | LambdaType // eslint-disable-line no-use-before-define
export type PrimitiveType = { kind: 'primitive', name: string }
export type TypeName = { kind: 'typename', name: string, typename: string }
export type VariantType = { kind: 'variant', name: string, members: Array<Type> }
export type ArrayType = { kind: 'array', name: string, itemType: Type, N: ?number }
export type NArgs = { kind: 'nargs', name: string, types: Array<Type>, N: number }
export type LambdaType = { kind: 'lambda', name: string, result: Type, params: Array<Type> }

const NullType = primitive('Null');
const NumberType = primitive('Number');
const StringType = primitive('String');
const BooleanType = primitive('Boolean');
const ColorType = primitive('Color');
const ObjectType = primitive('Object');

const ValueType = variant(
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ObjectType
);

const ValueArray = array(ValueType);
ValueType.members.push(ValueArray);
ValueType.name = 'Value';

function primitive(name) : PrimitiveType {
    return { kind: 'primitive', name };
}

function typename(tn: string) : TypeName {
    return { kind: 'typename', name: `${tn}`, typename: tn };
}

function variant(...types: Array<Type>) : VariantType {
    return {
        kind: 'variant',
        members: types,
        name: types.map(t => t.name).join(' | ')
    };
}

function array(itemType: Type, N: ?number) : ArrayType {
    return {
        kind: 'array',
        name: typeof N === 'number' ? `Array<${itemType.name}, ${N}>` :
            itemType === ValueType ? 'Array' : `Array<${itemType.name}>`,
        itemType,
        N
    };
}

function nargs(N: number, ...types: Array<Type>) : NArgs {
    return {
        kind: 'nargs',
        name: `${types.map(t => t.name).join(', ')}, ...`,
        types,
        N
    };
}

function lambda(result: Type, ...params: Array<Type>) : LambdaType {
    return {
        kind: 'lambda',
        name: `(${params.map(a => a.name).join(', ')}) => ${result.name}`,
        result,
        params
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
    typename,
    variant,
    array,
    lambda,
    nargs
};
