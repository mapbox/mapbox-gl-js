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
    'case': Case,
    'match': Match,
    'coalesce': Coalesce,
    'curve': Curve,
};

function rgba(ctx) {
    let [r, g, b, a] = this.args;
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

function length(ctx) {
    const [v] = this.args;
    return v.evaluate(ctx).length;
}

function eq(ctx) { const [a, b] = this.args; return a.evaluate(ctx) === b.evaluate(ctx); }
function ne(ctx) { const [a, b] = this.args; return a.evaluate(ctx) !== b.evaluate(ctx); }
function lt(ctx) { const [a, b] = this.args; return a.evaluate(ctx) < b.evaluate(ctx); }
function gt(ctx) { const [a, b] = this.args; return a.evaluate(ctx) > b.evaluate(ctx); }
function lteq(ctx) { const [a, b] = this.args; return a.evaluate(ctx) <= b.evaluate(ctx); }
function gteq(ctx) { const [a, b] = this.args; return a.evaluate(ctx) >= b.evaluate(ctx); }

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
        function (ctx) { throw new RuntimeError(this.args[0].evaluate(ctx)); }
    ],
    'typeof': [
        StringType,
        [ValueType],
        function (ctx) { return toString(typeOf(this.args[0].evaluate(ctx))); }
    ],
    'to-string': [
        StringType,
        [ValueType],
        function (ctx) {
            const v = this.args[0].evaluate(ctx);
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
        function (ctx) { return Boolean(this.args[0].evaluate(ctx)); }
    ],
    'to-rgba': [
        array(NumberType, 4),
        [ColorType],
        function (ctx) { return this.args[0].evaluate(ctx).value; }
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
                function (ctx) { return has(this.args[0].evaluate(ctx), ctx.properties()); }
            ], [
                [StringType, ObjectType],
                function (ctx) { return has(this.args[0].evaluate(ctx), this.args[1].evaluate(ctx)); }
            ]
        ]
    },
    'get': {
        type: ValueType,
        overloads: [
            [
                [StringType],
                function (ctx) { return get(this.args[0].evaluate(ctx), ctx.properties()); }
            ], [
                [StringType, ObjectType],
                function (ctx) { return get(this.args[0].evaluate(ctx), this.args[1].evaluate(ctx)); }
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
        function (ctx) {
            let result = 0;
            for (const arg of this.args) {
                result += arg.evaluate(ctx);
            }
            return result;
        }
    ],
    '*': [
        NumberType,
        varargs(NumberType),
        function (ctx) {
            let result = 1;
            for (const arg of this.args) {
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
                function (ctx) { return this.args[0].evaluate(ctx) - this.args[1].evaluate(ctx); }
            ], [
                [NumberType],
                function (ctx) { return -this.args[0].evaluate(ctx); }
            ]
        ]
    },
    '/': [
        NumberType,
        [NumberType, NumberType],
        function (ctx) { return this.args[0].evaluate(ctx) / this.args[1].evaluate(ctx); }
    ],
    '%': [
        NumberType,
        [NumberType, NumberType],
        function (ctx) { return this.args[0].evaluate(ctx) % this.args[1].evaluate(ctx); }
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
        function (ctx) { return Math.pow(this.args[0].evaluate(ctx), this.args[1].evaluate(ctx)); }
    ],
    'log10': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.log10(this.args[0].evaluate(ctx)); }
    ],
    'ln': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.log(this.args[0].evaluate(ctx)); }
    ],
    'log2': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.log2(this.args[0].evaluate(ctx)); }
    ],
    'sin': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.sin(this.args[0].evaluate(ctx)); }
    ],
    'cos': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.cos(this.args[0].evaluate(ctx)); }
    ],
    'tan': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.tan(this.args[0].evaluate(ctx)); }
    ],
    'asin': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.asin(this.args[0].evaluate(ctx)); }
    ],
    'acos': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.acos(this.args[0].evaluate(ctx)); }
    ],
    'atan': [
        NumberType,
        [NumberType],
        function (ctx) { return Math.atan(this.args[0].evaluate(ctx)); }
    ],
    'min': [
        NumberType,
        varargs(NumberType),
        function (ctx) { return Math.min(...this.args.map(arg => arg.evaluate(ctx))); }
    ],
    'max': [
        NumberType,
        varargs(NumberType),
        function (ctx) { return Math.max(...this.args.map(arg => arg.evaluate(ctx))); }
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
    'filter-==': [
        BooleanType,
        [StringType, ValueType],
        function (ctx) {
            return ctx.properties()[this.args[0].value] === this.args[1].value;
        }
    ],
    'filter-id-==': [
        BooleanType,
        [ValueType],
        function (ctx) {
            return ctx.id() === this.args[0].value;
        }
    ],
    'filter-type-==': [
        BooleanType,
        [StringType],
        function (ctx) {
            return ctx.geometryType() === this.args[0].value;
        }
    ],
    'filter-<': [
        BooleanType,
        [StringType, ValueType],
        function (ctx) {
            const v = ctx.properties()[this.args[0].value];
            const b = this.args[1];
            return typeof v === typeof b.value && v < b.value;
        }
    ],
    'filter-id-<': [
        BooleanType,
        [ValueType],
        function (ctx) {
            const v = ctx.id();
            const b = this.args[0];
            return typeof v === typeof b.value && v < b.value;
        }
    ],
    'filter->': [
        BooleanType,
        [StringType, ValueType],
        function (ctx) {
            const v = ctx.properties()[this.args[0].value];
            const b = this.args[1];
            return typeof v === typeof b.value && v > b.value;
        }
    ],
    'filter-id->': [
        BooleanType,
        [ValueType],
        function (ctx) {
            const v = ctx.id();
            const b = this.args[0];
            return typeof v === typeof b.value && v > b.value;
        }
    ],
    'filter-<=': [
        BooleanType,
        [StringType, ValueType],
        function (ctx) {
            const v = ctx.properties()[this.args[0].value];
            const b = this.args[1];
            return typeof v === typeof b.value && v <= b.value;
        }
    ],
    'filter-id-<=': [
        BooleanType,
        [ValueType],
        function (ctx) {
            const v = ctx.id();
            const b = this.args[0];
            return typeof v === typeof b.value && v <= b.value;
        }
    ],
    'filter->=': [
        BooleanType,
        [StringType, ValueType],
        function (ctx) {
            const v = ctx.properties()[this.args[0].value];
            const b = this.args[1];
            return typeof v === typeof b.value && v >= b.value;
        }
    ],
    'filter-id->=': [
        BooleanType,
        [ValueType],
        function (ctx) {
            const v = ctx.id();
            const b = this.args[0];
            return typeof v === typeof b.value && v >= b.value;
        }
    ],
    'filter-has': [
        BooleanType,
        [ValueType],
        function (ctx) { return this.args[0].value in ctx.properties(); }
    ],
    'filter-has-id': [
        BooleanType,
        [],
        (ctx) => ctx.id() !== null
    ],
    'filter-type-in': [
        BooleanType,
        [array(StringType)],
        function (ctx) { return this.args[0].value.indexOf(ctx.geometryType()) >= 0; }
    ],
    'filter-id-in': [
        BooleanType,
        [array(ValueType)],
        function (ctx) { return this.args[0].value.indexOf(ctx.id()) >= 0; }
    ],
    'filter-in-small': [
        BooleanType,
        [StringType, array(ValueType)],
        function (ctx) {
            // assumes this.args[1] is an array Literal
            const value = ctx.properties()[this.args[0].value];
            const array = this.args[1].value;
            return array.indexOf(value) >= 0;
        }
    ],
    'filter-in-large': [
        BooleanType,
        [StringType, array(ValueType)],
        function (ctx) {
            // assumes values is a array Literal with values
            // sorted in ascending order and of a single type
            const value = ctx.properties()[this.args[0].value];
            const array = this.args[1].value;
            return binarySearch(value, array, 0, array.length - 1);
        }
    ],
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
                function (ctx) { return this.args[0].evaluate(ctx) && this.args[1].evaluate(ctx); }
            ],
            [
                varargs(BooleanType),
                function (ctx) {
                    for (const arg of this.args) {
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
                function (ctx) { return this.args[0].evaluate(ctx) || this.args[1].evaluate(ctx); }
            ],
            [
                varargs(BooleanType),
                function (ctx) {
                    for (const arg of this.args) {
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
        function (ctx) { return !this.args[0].evaluate(ctx); }
    ],
    'upcase': [
        StringType,
        [StringType],
        function (ctx) { return this.args[0].evaluate(ctx).toUpperCase(); }
    ],
    'downcase': [
        StringType,
        [StringType],
        function (ctx) { return this.args[0].evaluate(ctx).toLowerCase(); }
    ],
    'concat': [
        StringType,
        varargs(StringType),
        function (ctx) { return this.args.map(arg => arg.evaluate(ctx)).join(''); }
    ]
});

module.exports = expressions;
