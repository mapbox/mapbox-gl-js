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
const Match = require('./match');
const Case = require('./case');
const Step = require('./step');
const Interpolate = require('./interpolate');
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
    'case': Case,
    'match': Match,
    'coalesce': Coalesce,
    'step': Step,
    'interpolate': Interpolate
};

function rgba(ctx, [r, g, b, a]) {
    r = r.evaluate(ctx);
    g = g.evaluate(ctx);
    b = b.evaluate(ctx);
    a = a && a.evaluate(ctx);
    const error = validateRGBA(r, g, b, a);
    if (error) throw new RuntimeError(error);
    return new Color(r / 255, g / 255, b / 255, a);
}

function has(key, obj) {
    return key in obj;
}

function get(key, obj) {
    const v = obj[key];
    return typeof v === 'undefined' ? null : v;
}

function length(ctx, [v]) {
    return v.evaluate(ctx).length;
}

function eq(ctx, [a, b]) { return a.evaluate(ctx) === b.evaluate(ctx); }
function ne(ctx, [a, b]) { return a.evaluate(ctx) !== b.evaluate(ctx); }
function lt(ctx, [a, b]) { return a.evaluate(ctx) < b.evaluate(ctx); }
function gt(ctx, [a, b]) { return a.evaluate(ctx) > b.evaluate(ctx); }
function lteq(ctx, [a, b]) { return a.evaluate(ctx) <= b.evaluate(ctx); }
function gteq(ctx, [a, b]) { return a.evaluate(ctx) >= b.evaluate(ctx); }

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
                return `rgba(${v.r * 255},${v.g * 255},${v.b * 255},${v.a})`;
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
            return [r, g, b, a];
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
    'length': {
        type: NumberType,
        overloads: [
            [
                [StringType],
                length
            ], [
                [array(ValueType)],
                length
            ]
        ]
    },
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
