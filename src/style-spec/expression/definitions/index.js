// @flow

const {
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
const Match = require('./match');
const Case = require('./case');
const Step = require('./step');
const Interpolate = require('./interpolate');
const Coalesce = require('./coalesce');
const {Equals, NotEquals} = require('./equals');
const Length = require('./length');

import type { ExpressionRegistry } from '../expression';

const expressions: ExpressionRegistry = {
    // special forms
    '==': Equals,
    '!=': NotEquals,
    'array': ArrayAssertion,
    'at': At,
    'boolean': Assertion,
    'case': Case,
    'coalesce': Coalesce,
    'interpolate': Interpolate,
    'length': Length,
    'let': Let,
    'literal': Literal,
    'match': Match,
    'number': Assertion,
    'object': Assertion,
    'step': Step,
    'string': Assertion,
    'to-color': Coercion,
    'to-number': Coercion,
    'var': Var
};

function rgba(ctx, [r, g, b, a]) {
    r = r.evaluate(ctx);
    g = g.evaluate(ctx);
    b = b.evaluate(ctx);
    const alpha = a ? a.evaluate(ctx) : 1;
    const error = validateRGBA(r, g, b, alpha);
    if (error) throw new RuntimeError(error);
    return new Color(r / 255 * alpha, g / 255 * alpha, b / 255 * alpha, alpha);
}

function has(key, obj) {
    return key in obj;
}

function get(key, obj) {
    const v = obj[key];
    return typeof v === 'undefined' ? null : v;
}

function lt(ctx, [a, b]) { return a.evaluate(ctx) < b.evaluate(ctx); }
function gt(ctx, [a, b]) { return a.evaluate(ctx) > b.evaluate(ctx); }
function lteq(ctx, [a, b]) { return a.evaluate(ctx) <= b.evaluate(ctx); }
function gteq(ctx, [a, b]) { return a.evaluate(ctx) >= b.evaluate(ctx); }

function binarySearch(v, a, i, j) {
    while (i <= j) {
        const m = (i + j) >> 1;
        if (a[m] === v)
            return true;
        if (a[m] > v)
            j = m - 1;
        else
            i = m + 1;
    }
    return false;
}


CompoundExpression.register(expressions, {
    'error': [
        ErrorType,
        [StringType],
        (ctx, [v]) => { throw new RuntimeError(v.evaluate(ctx)); }
    ],
    'typeof': [
        StringType,
        [ValueType],
        (ctx, [v]) => toString(typeOf(v.evaluate(ctx)))
    ],
    'to-string': [
        StringType,
        [ValueType],
        (ctx, [v]) => {
            v = v.evaluate(ctx);
            const type = typeof v;
            if (v === null || type === 'string' || type === 'number' || type === 'boolean') {
                return String(v);
            } else if (v instanceof Color) {
                return v.toString();
            } else {
                return JSON.stringify(v);
            }
        }
    ],
    'to-boolean': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => Boolean(v.evaluate(ctx))
    ],
    'to-rgba': [
        array(NumberType, 4),
        [ColorType],
        (ctx, [v]) => {
            const {r, g, b, a} = v.evaluate(ctx);
            return [255 * r / a, 255 * g / a, 255 * b / a, a];
        }
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
    'has': {
        type: BooleanType,
        overloads: [
            [
                [StringType],
                (ctx, [key]) => has(key.evaluate(ctx), ctx.properties())
            ], [
                [StringType, ObjectType],
                (ctx, [key, obj]) => has(key.evaluate(ctx), obj.evaluate(ctx))
            ]
        ]
    },
    'get': {
        type: ValueType,
        overloads: [
            [
                [StringType],
                (ctx, [key]) => get(key.evaluate(ctx), ctx.properties())
            ], [
                [StringType, ObjectType],
                (ctx, [key, obj]) => get(key.evaluate(ctx), obj.evaluate(ctx))
            ]
        ]
    },
    'properties': [
        ObjectType,
        [],
        (ctx) => ctx.properties()
    ],
    'geometry-type': [
        StringType,
        [],
        (ctx) => ctx.geometryType()
    ],
    'id': [
        ValueType,
        [],
        (ctx) => ctx.id()
    ],
    'zoom': [
        NumberType,
        [],
        (ctx) => ctx.globals.zoom
    ],
    'heatmap-density': [
        NumberType,
        [],
        (ctx) => ctx.globals.heatmapDensity || 0
    ],
    '+': [
        NumberType,
        varargs(NumberType),
        (ctx, args) => {
            let result = 0;
            for (const arg of args) {
                result += arg.evaluate(ctx);
            }
            return result;
        }
    ],
    '*': [
        NumberType,
        varargs(NumberType),
        (ctx, args) => {
            let result = 1;
            for (const arg of args) {
                result *= arg.evaluate(ctx);
            }
            return result;
        }
    ],
    '-': {
        type: NumberType,
        overloads: [
            [
                [NumberType, NumberType],
                (ctx, [a, b]) => a.evaluate(ctx) - b.evaluate(ctx)
            ], [
                [NumberType],
                (ctx, [a]) => -a.evaluate(ctx)
            ]
        ]
    },
    '/': [
        NumberType,
        [NumberType, NumberType],
        (ctx, [a, b]) => a.evaluate(ctx) / b.evaluate(ctx)
    ],
    '%': [
        NumberType,
        [NumberType, NumberType],
        (ctx, [a, b]) => a.evaluate(ctx) % b.evaluate(ctx)
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
        (ctx, [b, e]) => Math.pow(b.evaluate(ctx), e.evaluate(ctx))
    ],
    'sqrt': [
        NumberType,
        [NumberType],
        (ctx, [x]) => Math.sqrt(x.evaluate(ctx))
    ],
    'log10': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.log10(n.evaluate(ctx))
    ],
    'ln': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.log(n.evaluate(ctx))
    ],
    'log2': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.log2(n.evaluate(ctx))
    ],
    'sin': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.sin(n.evaluate(ctx))
    ],
    'cos': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.cos(n.evaluate(ctx))
    ],
    'tan': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.tan(n.evaluate(ctx))
    ],
    'asin': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.asin(n.evaluate(ctx))
    ],
    'acos': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.acos(n.evaluate(ctx))
    ],
    'atan': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.atan(n.evaluate(ctx))
    ],
    'min': [
        NumberType,
        varargs(NumberType),
        (ctx, args) => Math.min(...args.map(arg => arg.evaluate(ctx)))
    ],
    'max': [
        NumberType,
        varargs(NumberType),
        (ctx, args) => Math.max(...args.map(arg => arg.evaluate(ctx)))
    ],
    'filter-==': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => ctx.properties()[(k: any).value] === (v: any).value
    ],
    'filter-id-==': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => ctx.id() === (v: any).value
    ],
    'filter-type-==': [
        BooleanType,
        [StringType],
        (ctx, [v]) => ctx.geometryType() === (v: any).value
    ],
    'filter-<': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k: any).value];
            const b = (v: any).value;
            return typeof a === typeof b && a < b;
        }
    ],
    'filter-id-<': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v: any).value;
            return typeof a === typeof b && a < b;
        }
    ],
    'filter->': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k: any).value];
            const b = (v: any).value;
            return typeof a === typeof b && a > b;
        }
    ],
    'filter-id->': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v: any).value;
            return typeof a === typeof b && a > b;
        }
    ],
    'filter-<=': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k: any).value];
            const b = (v: any).value;
            return typeof a === typeof b && a <= b;
        }
    ],
    'filter-id-<=': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v: any).value;
            return typeof a === typeof b && a <= b;
        }
    ],
    'filter->=': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k: any).value];
            const b = (v: any).value;
            return typeof a === typeof b && a >= b;
        }
    ],
    'filter-id->=': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v: any).value;
            return typeof a === typeof b && a >= b;
        }
    ],
    'filter-has': [
        BooleanType,
        [ValueType],
        (ctx, [k]) => (k: any).value in ctx.properties()
    ],
    'filter-has-id': [
        BooleanType,
        [],
        (ctx) => ctx.id() !== null
    ],
    'filter-type-in': [
        BooleanType,
        [array(StringType)],
        (ctx, [v]) => (v: any).value.indexOf(ctx.geometryType()) >= 0
    ],
    'filter-id-in': [
        BooleanType,
        [array(ValueType)],
        (ctx, [v]) => (v: any).value.indexOf(ctx.id()) >= 0
    ],
    'filter-in-small': [
        BooleanType,
        [StringType, array(ValueType)],
        // assumes v is an array literal
        (ctx, [k, v]) => (v: any).value.indexOf(ctx.properties()[(k: any).value]) >= 0
    ],
    'filter-in-large': [
        BooleanType,
        [StringType, array(ValueType)],
        // assumes v is a array literal with values sorted in ascending order and of a single type
        (ctx, [k, v]) => binarySearch(ctx.properties()[(k: any).value], (v: any).value, 0, (v: any).value.length - 1)
    ],
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
    'all': {
        type: BooleanType,
        overloads: [
            [
                [BooleanType, BooleanType],
                (ctx, [a, b]) => a.evaluate(ctx) && b.evaluate(ctx)
            ],
            [
                varargs(BooleanType),
                (ctx, args) => {
                    for (const arg of args) {
                        if (!arg.evaluate(ctx))
                            return false;
                    }
                    return true;
                }
            ]
        ]
    },
    'any': {
        type: BooleanType,
        overloads: [
            [
                [BooleanType, BooleanType],
                (ctx, [a, b]) => a.evaluate(ctx) || b.evaluate(ctx)
            ],
            [
                varargs(BooleanType),
                (ctx, args) => {
                    for (const arg of args) {
                        if (arg.evaluate(ctx))
                            return true;
                    }
                    return false;
                }
            ]
        ]
    },
    '!': [
        BooleanType,
        [BooleanType],
        (ctx, [b]) => !b.evaluate(ctx)
    ],
    'upcase': [
        StringType,
        [StringType],
        (ctx, [s]) => s.evaluate(ctx).toUpperCase()
    ],
    'downcase': [
        StringType,
        [StringType],
        (ctx, [s]) => s.evaluate(ctx).toLowerCase()
    ],
    'concat': [
        StringType,
        varargs(StringType),
        (ctx, args) => args.map(arg => arg.evaluate(ctx)).join('')
    ]
});

module.exports = expressions;
