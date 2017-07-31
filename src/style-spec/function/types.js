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

/**
 * Returns null if the type matches, or an error message if not.
 *
 * Also populate the given typenames context when a generic type is successfully
 * matched against a concrete one, with `scope` controlling whether type names
 * from `expected` or `t` are to be bound.
 *
 * @private
 */
function match(
    expected: Type,
    t: Type
) {
    const errorMessage = `Expected ${expected.name} but found ${t.name} instead.`;

    // a `null` literal is allowed anywhere.
    if (t.name === 'Null') return null;

    if (expected.name === 'Value') {
        if (t === expected) return null;
        const members = [
            NumberType,
            StringType,
            BooleanType,
            ColorType,
            ObjectType,
            array(ValueType)
        ];

        for (const memberType of members) {
            if (!match(memberType, t)) {
                return null;
            }
        }

        return errorMessage;
    } if (expected.kind === 'primitive') {
        if (t === expected) return null;
        else return errorMessage;
    } else if (expected.kind === 'array') {
        if (t.kind === 'array') {
            const error = match(expected.itemType, t.itemType);
            if (error) return `${errorMessage} (${error})`;
            else if (typeof expected.N === 'number' && expected.N !== t.N) return errorMessage;
            else return null;
        } else {
            return errorMessage;
        }
    }

    throw new Error(`${expected.name} is not a valid output type.`);
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
    match
};
