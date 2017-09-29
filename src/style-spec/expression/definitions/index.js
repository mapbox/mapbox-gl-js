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
    array,
    ErrorType
} = require('../types');

const { CompoundExpression, varargs } = require('../compound_expression');
const Let = require('./let');
const Var = require('./var');
const Literal = require('./literal');
const Assertion = require('./assertion');
const ArrayAssertion = require('./array');
const Coercion = require('./coercion');
const At = require('./at');
const Contains = require('./contains');
const Match = require('./match');
const Case = require('./case');
const Curve = require('./curve');
const Coalesce = require('./coalesce');

import type { Expression } from '../expression';

const expressions: { [string]: Class<Expression> } = {
    // special forms
    'let': Let,
    'var': Var,
    'literal': Literal,
    'string': Assertion,
    'number': Assertion,
    'boolean': Assertion,
    'object': Assertion,
    'array': ArrayAssertion,
    'to-number': Coercion,
    'to-color': Coercion,
    'at': At,
    'contains': Contains,
    'case': Case,
    'match': Match,
    'coalesce': Coalesce,
    'curve': Curve,
};

CompoundExpression.register(expressions, {
    'error': [ ErrorType, [ StringType ], fromContext('error') ],
    'ln2': [ NumberType, [], () => 'Math.LN2'],
    'pi': [ NumberType, [], () => 'Math.PI'],
    'e': [ NumberType, [], () => 'Math.E'],
    'typeof': [ StringType, [ValueType], fromContext('typeOf') ],
    'to-string': [ StringType, [ValueType], fromContext('toString') ],
    'to-boolean': [ BooleanType, [ValueType], (ctx, [v]) =>
        `Boolean(${cache(ctx, v)})` ],
    'to-rgba': [ array(NumberType, 4), [ColorType], (ctx, [v]) =>
        `${cache(ctx, v)}.value` ],
    'rgb': [ ColorType, [NumberType, NumberType, NumberType],
        fromContext('rgba') ],
    'rgba': [ ColorType, [NumberType, NumberType, NumberType, NumberType],
        fromContext('rgba') ],
    'get': {
        type: ValueType,
        overloads: [
            [[StringType], (ctx, [k]) =>
                `$this.get($props, ${cache(ctx, k)})`],
            [[StringType, ObjectType], (ctx, [k, obj]) =>
                `$this.get(${cache(ctx, obj)}, ${cache(ctx, k)})`
            ]
        ]
    },
    'has': {
        type: BooleanType,
        overloads: [
            [[StringType], (ctx, [k]) =>
                `$this.has($props, ${cache(ctx, k)}, 'feature.properties')`],
            [[StringType, ObjectType], (ctx, [k, obj]) =>
                `$this.has(${cache(ctx, obj)}, ${cache(ctx, k)})`
            ]
        ]
    },
    'length': {
        type: NumberType,
        overloads: [
            [[StringType], (ctx, [s]) =>
                `${cache(ctx, s)}.length`],
            [[array(ValueType)], (ctx, [arr]) =>
                `${cache(ctx, arr)}.length`]
        ]
    },
    'properties': [ObjectType, [], () => '$props'
    ],
    'geometry-type': [ StringType, [], () =>
        '$this.geometryType($feature)'
    ],
    'id': [ ValueType, [], () =>
        `('id' in $feature) ? $feature.id : null`
    ],
    'zoom': [ NumberType, [], () => '$globalProperties.zoom' ],
    '+': defineBinaryMathOp('+', true),
    '*': defineBinaryMathOp('*', true),
    '-': {
        type: NumberType,
        overloads: [
            [[NumberType, NumberType], (ctx, [a, b]) => `${cache(ctx, a)} - ${cache(ctx, b)}`],
            [[NumberType], (ctx, [a]) => `-${cache(ctx, a)}`]
        ]
    },
    '/': defineBinaryMathOp('/'),
    '%': defineBinaryMathOp('%'),
    '^': [ NumberType, [NumberType, NumberType], (ctx, [base, exp]) =>
        `Math.pow(${cache(ctx, base)}, ${cache(ctx, exp)})`
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
    'min': [
        NumberType,
        varargs(NumberType),
        (ctx, args) => `Math.min(${args.map(a => cache(ctx, a)).join(', ')})`
    ],
    'max': [
        NumberType,
        varargs(NumberType),
        (ctx, args) => `Math.max(${args.map(a => cache(ctx, a)).join(', ')})`
    ],
    '==': defineComparisonOp('=='),
    '!=': defineComparisonOp('!='),
    '>': defineComparisonOp('>'),
    '<': defineComparisonOp('<'),
    '>=': defineComparisonOp('>='),
    '<=': defineComparisonOp('<='),
    '&&': defineBooleanOp('&&'),
    '||': defineBooleanOp('||'),
    '!': [BooleanType, [BooleanType], (ctx, [input]) => `!(${cache(ctx, input)})`],
    // string manipulation
    'upcase': [StringType, [StringType], (ctx, [s]) => `(${cache(ctx, s)}).toUpperCase()`],
    'downcase': [StringType, [StringType], (ctx, [s]) => `(${cache(ctx, s)}).toLowerCase()`],
    'concat': [ StringType, varargs(StringType), (ctx, args) =>
        `[${args.map(a => cache(ctx, a)).join(', ')}].join('')`
    ],
});

function defineMathFunction(name: string, arity: number) {
    assert(typeof Math[name] === 'function');
    assert(arity > 0);
    const signature = [];
    while (arity-- > 0) signature.push(NumberType);
    return [NumberType, signature, (ctx, args) =>
        `Math.${name}(${args.map(a => cache(ctx, a)).join(', ')})`
    ];
}
function defineBinaryMathOp(name, isAssociative) {
    const signature = isAssociative ? varargs(NumberType) : [NumberType, NumberType];
    return [NumberType, signature, (ctx, args) =>
        args.map(a => cache(ctx, a)).join(name)
    ];
}

function defineComparisonOp(name) {
    const op = name === '==' ? '===' :
        name === '!=' ? '!==' : name;
    const compile = (ctx, [lhs, rhs]) =>
        `${cache(ctx, lhs)} ${op} ${cache(ctx, rhs)}`;
    const overloads = [
        [[NumberType, NumberType], compile],
        [[StringType, StringType], compile]
    ];
    if (name === '==' || name === '!=') {
        overloads.push([[BooleanType, BooleanType], compile]);
        overloads.push([[NullType, NullType], compile]);
    }
    return {
        type: BooleanType,
        overloads
    };
}

function defineBooleanOp(op) {
    return [BooleanType, varargs(BooleanType), (ctx, args) =>
        args.map(a => cache(ctx, a)).join(op)];
}

function fromContext(name: string) {
    return (ctx, args) =>
        `$this.${name}(${args.map(a => cache(ctx, a)).join(', ')})`;
}

// helper for conciseness in the above definitions
function cache(ctx, expression) {
    return ctx.compileAndCache(expression);
}

module.exports = expressions;
