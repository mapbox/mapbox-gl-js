// @flow

const {
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    ErrorType,
    array,
    toString
} = require('../types');

const { typeOf, Color, validateRGBA } = require('../values');
const { CompoundExpression, varargs } = require('../compound_expression');
const RuntimeError = require('../runtime_error');
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

import type { Value } from '../values';
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

function rgba(r: number, g: number, b: number, a?: number) {
    const error = validateRGBA(r, g, b, a);
    if (error) throw new RuntimeError(error);
    return new Color(r / 255, g / 255, b / 255, a);
}

function has(obj: {[string]: Value}, key: string) {
    const v = obj[key];
    return typeof v !== 'undefined';
}

function get(obj: {[string]: Value}, key: string) {
    const v = obj[key];
    return typeof v === 'undefined' ? null : v;
}

function eq(a, b) { return a === b; }
function ne(a, b) { return a !== b; }
function lt(a, b) { return a < b; }
function gt(a, b) { return a > b; }
function lteq(a, b) { return a <= b; }
function gteq(a, b) { return a >= b; }

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

CompoundExpression.register(expressions, {
    'error': [
        ErrorType,
        [StringType],
        msg => { throw new RuntimeError(msg); }
    ],
    'typeof': [
        StringType,
        [ValueType],
        v => toString(typeOf(v))
    ],
    'to-string': [
        StringType,
        [ValueType],
        v => {
            const type = typeof v;
            if (v === null || type === 'string' || type === 'number' || type === 'boolean') {
                return String(v);
            } else if (v instanceof Color) {
                const [r, g, b, a] = v.value;
                return `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
            } else {
                return JSON.stringify(v);
            }
        }
    ],
    'to-boolean': [
        BooleanType,
        [ValueType],
        Boolean
    ],
    'to-rgba': [
        array(NumberType, 4),
        [ColorType],
        v => v.value
    ],
    'rgb': [
        ColorType,
        [NumberType, NumberType, NumberType],
        rgba
    ],
    'rgba': [
        ColorType,
        [NumberType, NumberType, NumberType, NumberType],
        rgba
    ],
    'length': {
        type: NumberType,
        overloads: [
            [
                [StringType],
                s => s.length
            ], [
                [array(ValueType)],
                a => a.length
            ]
        ]
    },
    'has': {
        type: BooleanType,
        overloads: [
            [
                [StringType],
                function (k) { return has(this.feature && this.feature.properties || {}, k); }
            ], [
                [StringType, ObjectType],
                (k, obj) => has(obj, k)
            ]
        ]
    },
    'get': {
        type: ValueType,
        overloads: [
            [
                [StringType],
                function (k) { return get(this.feature && this.feature.properties || {}, k); }
            ], [
                [StringType, ObjectType],
                (k, obj) => get(obj, k)
            ]
        ]
    },
    'properties': [
        ObjectType,
        [],
        function () { return this.feature && this.feature.properties || {}; }
    ],
    'geometry-type': [
        StringType,
        [],
        function () {
            return typeof this.feature.type === 'number' ?
                geometryTypes[this.feature.type] :
                this.feature.type;
        }
    ],
    'id': [
        ValueType,
        [],
        function () { return 'id' in this.feature ? this.feature.id : null; }
    ],
    'zoom': [
        NumberType,
        [],
        function ()  { return this.globals.zoom; }
    ],
    '+': [
        NumberType,
        varargs(NumberType),
        (...args) => args.reduce((a, b) => a + b, 0)
    ],
    '*': [
        NumberType,
        varargs(NumberType),
        (...args) => args.reduce((a, b) => a * b, 1)
    ],
    '-': {
        type: NumberType,
        overloads: [
            [
                [NumberType, NumberType],
                (a, b) => a - b
            ], [
                [NumberType],
                a => -a
            ]
        ]
    },
    '/': [
        NumberType,
        [NumberType, NumberType],
        (a, b) => a / b
    ],
    '%': [
        NumberType,
        [NumberType, NumberType],
        (a, b) => a % b
    ],
    'ln2': [
        NumberType,
        [],
        () => Math.LN2
    ],
    'pi': [
        NumberType,
        [],
        () => Math.PI
    ],
    'e': [
        NumberType,
        [],
        () => Math.E
    ],
    '^': [
        NumberType,
        [NumberType, NumberType],
        Math.pow
    ],
    'log10': [
        NumberType,
        [NumberType],
        Math.log10
    ],
    'ln': [
        NumberType,
        [NumberType],
        Math.log
    ],
    'log2': [
        NumberType,
        [NumberType],
        Math.log2
    ],
    'sin': [
        NumberType,
        [NumberType],
        Math.sin
    ],
    'cos': [
        NumberType,
        [NumberType],
        Math.cos
    ],
    'tan': [
        NumberType,
        [NumberType],
        Math.tan
    ],
    'asin': [
        NumberType,
        [NumberType],
        Math.asin
    ],
    'acos': [
        NumberType,
        [NumberType],
        Math.acos
    ],
    'atan': [
        NumberType,
        [NumberType],
        Math.atan
    ],
    'min': [
        NumberType,
        varargs(NumberType),
        Math.min
    ],
    'max': [
        NumberType,
        varargs(NumberType),
        Math.max
    ],
    '==': {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], eq],
            [[StringType, StringType], eq],
            [[BooleanType, BooleanType], eq],
            [[NullType, NullType], eq]
        ]
    },
    '!=': {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], ne],
            [[StringType, StringType], ne],
            [[BooleanType, BooleanType], ne],
            [[NullType, NullType], ne]
        ]
    },
    '>': {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], gt],
            [[StringType, StringType], gt]
        ]
    },
    '<': {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], lt],
            [[StringType, StringType], lt]
        ]
    },
    '>=': {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], gteq],
            [[StringType, StringType], gteq]
        ]
    },
    '<=': {
        type: BooleanType,
        overloads: [
            [[NumberType, NumberType], lteq],
            [[StringType, StringType], lteq]
        ]
    },
    '&&': [
        BooleanType,
        varargs(BooleanType),
        (...args) => args.reduce((a, b) => a && b, true)
    ],
    '||': [
        BooleanType,
        varargs(BooleanType),
        (...args) => args.reduce((a, b) => a || b, false)
    ],
    '!': [
        BooleanType,
        [BooleanType],
        b => !b
    ],
    'upcase': [
        StringType,
        [StringType],
        s => s.toUpperCase()
    ],
    'downcase': [
        StringType,
        [StringType],
        s => s.toLowerCase()
    ],
    'concat': [
        StringType,
        varargs(StringType),
        (...args) => args.join('')
    ]
});

module.exports = expressions;
