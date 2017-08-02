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
} = require('../types');

const { CompoundExpression, varargs } = require('../compound_expression');
const Let = require('./let');
const Var = require('./var');
const Literal = require('./literal');
const ArrayAssertion = require('./array');
const At = require('./at');
const Match = require('./match');
const Case = require('./case');
const Curve = require('./curve');
const Coalesce = require('./coalesce');

import type { Expression } from '../expression';
import type { Type } from '../types';

const expressions: { [string]: Class<Expression> } = {
    // special forms
    'let': Let,
    'var': Var,
    'literal': Literal,
    'array': ArrayAssertion,
    'at': At,
    'case': Case,
    'match': Match,
    'coalesce': Coalesce,
    'curve': Curve,
};

CompoundExpression.register(expressions, {
    'ln2': [ NumberType, [], () => 'Math.LN2'],
    'pi': [ NumberType, [], () => 'Math.PI'],
    'e': [ NumberType, [], () => 'Math.E'],
    'typeof': [ StringType, [ValueType], fromContext('typeOf') ],
    'string': defineAssertion(StringType),
    'number': defineAssertion(NumberType),
    'boolean': defineAssertion(BooleanType),
    'to_string': [ StringType, [ValueType], fromContext('toString') ],
    'to_number': [ NumberType, [ValueType], fromContext('toNumber') ],
    'to_boolean': [ BooleanType, [ValueType], ([v]) => `Boolean(${v})` ],
    'to_rgba': [ array(NumberType, 4), [ColorType], ([v]) => `${v}.value` ],
    'parse_color': [ ColorType, [StringType], fromContext('parseColor') ],
    'rgb': [ ColorType, [NumberType, NumberType, NumberType],
        fromContext('rgba') ],
    'rgba': [ ColorType, [NumberType, NumberType, NumberType, NumberType],
        fromContext('rgba') ],
    'get': {
        type: ValueType,
        overloads: [
            [[StringType], ([k]) => `this.get(props, ${k}, 'feature.properties')`],
            [[StringType, ObjectType], ([k, obj]) =>
                `this.get(${obj}, ${k})`
            ]
        ]
    },
    'has': {
        type: BooleanType,
        overloads: [
            [[StringType], ([k]) => `this.has(props, ${k}, 'feature.properties')`],
            [[StringType, ObjectType], ([k, obj]) =>
                `this.has(${obj}, ${k})`
            ]
        ]
    },
    'length': {
        type: NumberType,
        overloads: [
            [[StringType], ([s]) => `${s}.length`],
            [[array(ValueType)], ([arr]) => `${arr}.length`]
        ]
    },
    'properties': [ObjectType, [], () =>
        'this.as(props, "Object", "feature.properties")'
    ],
    'geometry_type': [ StringType, [], () =>
        'this.get(this.get(feature, "geometry", "feature"), "type", "feature.geometry")'
    ],
    'id': [ ValueType, [], () =>
        'this.get(feature, "id", "feature")'
    ],
    'zoom': [ NumberType, [], () => 'mapProperties.zoom' ],
    '+': defineBinaryMathOp('+', true),
    '*': defineBinaryMathOp('*', true),
    '-': defineBinaryMathOp('-'),
    '/': defineBinaryMathOp('/'),
    '%': defineBinaryMathOp('%'),
    '^': [ NumberType, [NumberType, NumberType], ([base, exp]) =>
        `Math.pow(${base}, ${exp})`
    ],
    'log10': defineMathFunction('log10', 1),
    'ln': defineMathFunction('log', 1),
    'log2': defineMathFunction('log2', 1),
    'sin': defineMathFunction('sin', 1),
    'cos': defineMathFunction('cos', 1),
    'tan': defineMathFunction('tan', 1),
    'asin': defineMathFunction('asin', 1),
    'acos': defineMathFunction('acos', 1),
    'atan': defineMathFunction('atan', 1),
    '==': defineComparisonOp('=='),
    '!=': defineComparisonOp('!='),
    '>': defineComparisonOp('>'),
    '<': defineComparisonOp('<'),
    '>=': defineComparisonOp('>='),
    '<=': defineComparisonOp('<='),
    '&&': defineBooleanOp('&&'),
    '||': defineBooleanOp('||'),
    '!': [BooleanType, [BooleanType], ([input]) => `!(${input})`],
    // string manipulation
    'upcase': [StringType, [StringType], ([s]) => `(${s}).toUpperCase()`],
    'downcase': [StringType, [StringType], ([s]) => `(${s}).toLowerCase()`],
    'concat': [ StringType, varargs(StringType), (args) =>
        `[${args.join(', ')}].join('')`
    ],
});

function defineAssertion(type: Type) {
    return [ type, [ValueType],  (args) =>
        `this.as(${args[0]}, ${JSON.stringify(type.name)})`
    ];
}

function defineMathFunction(name: string, arity: number) {
    assert(typeof Math[name] === 'function');
    assert(arity > 0);
    const signature = [];
    while (arity-- > 0) signature.push(NumberType);
    return [NumberType, signature, (args) => `Math.${name}(${args.join(', ')})`];
}

function defineBinaryMathOp(name, isAssociative) {
    const signature = isAssociative ? varargs(NumberType) : [NumberType, NumberType];
    return [NumberType, signature, (args) => args.join(name)];
}

function defineComparisonOp(name) {
    const op = name === '==' ? '===' :
        name === '!=' ? '!==' : name;
    const compile = ([lhs, rhs]) => `${lhs} ${op} ${rhs}`;
    return {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], compile],
            [[BooleanType, BooleanType], compile],
            [[StringType, StringType], compile],
            [[NullType, NullType], compile],
        ]
    };
}

function defineBooleanOp(op) {
    return [BooleanType, varargs(BooleanType), (args) => args.join(op)];
}

function fromContext(name: string) {
    return (args) => `this.${name}(${args.join(', ')})`;
}


module.exports = expressions;
