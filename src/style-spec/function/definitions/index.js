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
    'to-number': [ NumberType, varargs(ValueType), (args, argIds, ctx) => {
        const argsArr = ctx.addVariable(`[${argIds.join(',')}]`);
        return `$this.toNumber(${argsArr})`;
    } ],
    'to-boolean': [ BooleanType, [ValueType], ([v]) => `Boolean(${v})` ],
    'to-color': [ ColorType, varargs(ValueType), (args, argIds, ctx) => {
        const argsArr = ctx.addVariable(`[${argIds.join(',')}]`);
        return `$this.toColor(${argsArr})`;
    } ],
    'to-rgba': [ array(NumberType, 4), [ColorType], ([v]) => `${v}.value` ],
    'rgb': [ ColorType, [NumberType, NumberType, NumberType],
        fromContext('rgba') ],
    'rgba': [ ColorType, [NumberType, NumberType, NumberType, NumberType],
        fromContext('rgba') ],
    'get': {
        type: ValueType,
        overloads: [
            [[StringType], ([k]) => `$this.get($props, ${k})`],
            [[StringType, ObjectType], ([k, obj]) =>
                `$this.get(${obj}, ${k})`
            ]
        ]
    },
    'has': {
        type: BooleanType,
        overloads: [
            [[StringType], ([k]) => `$this.has($props, ${k}, 'feature.properties')`],
            [[StringType, ObjectType], ([k, obj]) =>
                `$this.has(${obj}, ${k})`
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
            [[NumberType, NumberType], ([a, b]) => `${a} - ${b}`],
            [[NumberType], ([a]) => `-${a}`]
        ]
    },
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
    'min': [
        NumberType,
        varargs(NumberType),
        (args) => `Math.min(${args.join(', ')})`
    ],
    'max': [
        NumberType,
        varargs(NumberType),
        (args) => `Math.max(${args.join(', ')})`
    ],
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
    return [BooleanType, varargs(BooleanType), (args) => args.join(op)];
}

function fromContext(name: string) {
    return (args) => `$this.${name}(${args.join(', ')})`;
}


module.exports = expressions;
