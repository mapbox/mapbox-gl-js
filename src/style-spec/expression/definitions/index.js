// @flow

import {
    type Type,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    ErrorType,
    CollatorType,
    array,
    toString as typeToString
} from '../types.js';

import {typeOf, Color, validateRGBA, validateHSLA, toString as valueToString} from '../values.js';
import CompoundExpression from '../compound_expression.js';
import RuntimeError from '../runtime_error.js';
import Let from './let.js';
import Var from './var.js';
import Literal from './literal.js';
import Assertion from './assertion.js';
import Coercion from './coercion.js';
import At from './at.js';
import In from './in.js';
import IndexOf from './index_of.js';
import Match from './match.js';
import Case from './case.js';
import Slice from './slice.js';
import Step from './step.js';
import Interpolate from './interpolate.js';
import Coalesce from './coalesce.js';
import {
    Equals,
    NotEquals,
    LessThan,
    GreaterThan,
    LessThanOrEqual,
    GreaterThanOrEqual
} from './comparison.js';
import CollatorExpression from './collator.js';
import NumberFormat from './number_format.js';
import FormatExpression from './format.js';
import ImageExpression from './image.js';
import Length from './length.js';
import Within from './within.js';
import Config from './config.js';
import Distance from './distance.js';
import {mulberry32} from '../../util/random.js';

import type EvaluationContext from '../evaluation_context.js';
import type {Varargs} from '../compound_expression.js';
import type {Expression, ExpressionRegistry} from '../expression.js';

const expressions: ExpressionRegistry = {
    // special forms
    '==': Equals,
    '!=': NotEquals,
    '>': GreaterThan,
    '<': LessThan,
    '>=': GreaterThanOrEqual,
    '<=': LessThanOrEqual,
    // $FlowFixMe[method-unbinding]
    'array': Assertion,
    // $FlowFixMe[method-unbinding]
    'at': At,
    'boolean': Assertion,
    // $FlowFixMe[method-unbinding]
    'case': Case,
    // $FlowFixMe[method-unbinding]
    'coalesce': Coalesce,
    // $FlowFixMe[method-unbinding]
    'collator': CollatorExpression,
    // $FlowFixMe[method-unbinding]
    'format': FormatExpression,
    // $FlowFixMe[method-unbinding]
    'image': ImageExpression,
    // $FlowFixMe[method-unbinding]
    'in': In,
    // $FlowFixMe[method-unbinding]
    'index-of': IndexOf,
    // $FlowFixMe[method-unbinding]
    'interpolate': Interpolate,
    'interpolate-hcl': Interpolate,
    'interpolate-lab': Interpolate,
    // $FlowFixMe[method-unbinding]
    'length': Length,
    // $FlowFixMe[method-unbinding]
    'let': Let,
    // $FlowFixMe[method-unbinding]
    'literal': Literal,
    // $FlowFixMe[method-unbinding]
    'match': Match,
    'number': Assertion,
    // $FlowFixMe[method-unbinding]
    'number-format': NumberFormat,
    'object': Assertion,
    // $FlowFixMe[method-unbinding]
    'slice': Slice,
    // $FlowFixMe[method-unbinding]
    'step': Step,
    'string': Assertion,
    // $FlowFixMe[method-unbinding]
    'to-boolean': Coercion,
    'to-color': Coercion,
    'to-number': Coercion,
    'to-string': Coercion,
    // $FlowFixMe[method-unbinding]
    'var': Var,
    // $FlowFixMe[method-unbinding]
    'within': Within,
    // $FlowFixMe[method-unbinding]
    'distance': Distance,
    // $FlowFixMe[method-unbinding]
    'config': Config
};

function rgba(ctx: EvaluationContext, [r, g, b, a]: Array<Expression>) {
    r = r.evaluate(ctx);
    g = g.evaluate(ctx);
    b = b.evaluate(ctx);
    const alpha = a ? a.evaluate(ctx) : 1;
    const error = validateRGBA(r, g, b, alpha);
    if (error) throw new RuntimeError(error);
    return new Color(r / 255 * alpha, g / 255 * alpha, b / 255 * alpha, alpha);
}

function hsla(ctx: EvaluationContext, [h, s, l, a]: Array<Expression>) {
    h = h.evaluate(ctx);
    s = s.evaluate(ctx);
    l = l.evaluate(ctx);
    const alpha = a ? a.evaluate(ctx) : 1;
    const error = validateHSLA(h, s, l, alpha);
    if (error) throw new RuntimeError(error);
    const colorFunction = `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    const color = Color.parse(colorFunction);
    if (!color) throw new RuntimeError(`Failed to parse HSLA color: ${colorFunction}`);
    return color;
}

function has(key: string, obj: {[string]: any}): boolean {
    return key in obj;
}

function get(key: string, obj: {[string]: any}) {
    const v = obj[key];
    return typeof v === 'undefined' ? null : v;
}

function binarySearch(v: any, a: {[number]: any}, i: number, j: number) {
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

function varargs(type: Type): Varargs {
    return {type};
}

function hashString(str: string) {
    let hash = 0;
    if (str.length === 0) {
        return hash;
    }
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
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
        (ctx, [v]) => typeToString(typeOf(v.evaluate(ctx)))
    ],
    'to-rgba': [
        array(NumberType, 4),
        [ColorType],
        (ctx, [v]) => {
            return v.evaluate(ctx).toArray();
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
    'hsl': [
        ColorType,
        [NumberType, NumberType, NumberType],
        hsla
    ],
    'hsla': [
        ColorType,
        [NumberType, NumberType, NumberType, NumberType],
        hsla
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
    'feature-state': [
        ValueType,
        [StringType],
        (ctx, [key]) => get(key.evaluate(ctx), ctx.featureState || {})
    ],
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
    'pitch': [
        NumberType,
        [],
        (ctx) => ctx.globals.pitch || 0
    ],
    'distance-from-center': [
        NumberType,
        [],
        (ctx) => ctx.distanceFromCenter()
    ],
    'measure-light': [
        NumberType,
        [StringType],
        (ctx, [s]) => ctx.measureLight(s.evaluate(ctx))
    ],
    'heatmap-density': [
        NumberType,
        [],
        (ctx) => ctx.globals.heatmapDensity || 0
    ],
    'line-progress': [
        NumberType,
        [],
        (ctx) => ctx.globals.lineProgress || 0
    ],
    'raster-value': [
        NumberType,
        [],
        (ctx) => ctx.globals.rasterValue || 0
    ],
    'raster-particle-speed': [
        NumberType,
        [],
        (ctx) => ctx.globals.rasterParticleSpeed || 0
    ],
    'sky-radial-progress': [
        NumberType,
        [],
        (ctx) => ctx.globals.skyRadialProgress || 0
    ],
    'accumulated': [
        ValueType,
        [],
        (ctx) => ctx.globals.accumulated === undefined ? null : ctx.globals.accumulated
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
        (ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN10
    ],
    'ln': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.log(n.evaluate(ctx))
    ],
    'log2': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN2
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
    'abs': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.abs(n.evaluate(ctx))
    ],
    'round': [
        NumberType,
        [NumberType],
        (ctx, [n]) => {
            const v = n.evaluate(ctx);
            // Javascript's Math.round() rounds towards +Infinity for halfway
            // values, even when they're negative. It's more common to round
            // away from 0 (e.g., this is what python and C++ do)
            return v < 0 ? -Math.round(-v) : Math.round(v);
        }
    ],
    'floor': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.floor(n.evaluate(ctx))
    ],
    'ceil': [
        NumberType,
        [NumberType],
        (ctx, [n]) => Math.ceil(n.evaluate(ctx))
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
        (ctx) => (ctx.id() !== null && ctx.id() !== undefined)
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
    'is-supported-script': [
        BooleanType,
        [StringType],
        // At parse time this will always return true, so we need to exclude this expression with isGlobalPropertyConstant
        (ctx, [s]) => {
            const isSupportedScript = ctx.globals && ctx.globals.isSupportedScript;
            if (isSupportedScript) {
                return isSupportedScript(s.evaluate(ctx));
            }
            return true;
        }
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
        varargs(ValueType),
        (ctx, args) => args.map(arg => valueToString(arg.evaluate(ctx))).join('')
    ],
    'resolved-locale': [
        StringType,
        [CollatorType],
        (ctx, [collator]) => collator.evaluate(ctx).resolvedLocale()
    ],
    'random': [
        NumberType,
        [NumberType, NumberType, ValueType],
        (ctx, args) => {
            const [min, max, seed] = args.map(arg => arg.evaluate(ctx));
            if (min > max) {
                return min;
            }
            if (min === max) {
                return min;
            }
            let seedVal;
            if (typeof seed === 'string') {
                seedVal = hashString(seed);
            } else if (typeof seed === 'number') {
                seedVal = seed;
            } else {
                throw new RuntimeError(`Invalid seed input: ${seed}`);
            }
            const random = mulberry32(seedVal)();
            return min + random * (max - min);
        }
    ],
});

export default expressions;
