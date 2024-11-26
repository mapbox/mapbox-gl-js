import {
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    ErrorType,
    CollatorType,
    array,
    toString as typeToString,
} from '../types';
import {typeOf, Color, validateRGBA, validateHSLA, toString as valueToString} from '../values';
import CompoundExpression from '../compound_expression';
import RuntimeError from '../runtime_error';
import Let from './let';
import Var from './var';
import Literal from './literal';
import Assertion from './assertion';
import Coercion from './coercion';
import At from './at';
import In from './in';
import IndexOf from './index_of';
import Match from './match';
import Case from './case';
import Slice from './slice';
import Step from './step';
import Interpolate from './interpolate';
import Coalesce from './coalesce';
import {
    Equals,
    NotEquals,
    LessThan,
    GreaterThan,
    LessThanOrEqual,
    GreaterThanOrEqual
} from './comparison';
import CollatorExpression from './collator';
import NumberFormat from './number_format';
import FormatExpression from './format';
import ImageExpression from './image';
import Length from './length';
import Within from './within';
import Config from './config';
import Distance from './distance';
import {mulberry32} from '../../util/random';

import type {Type} from '../types';
import type EvaluationContext from '../evaluation_context';
import type {Varargs} from '../compound_expression';
import type {Expression, ExpressionRegistry} from '../expression';

const expressions: ExpressionRegistry = {
    // special forms
    '==': Equals,
    '!=': NotEquals,
    '>': GreaterThan,
    '<': LessThan,
    '>=': GreaterThanOrEqual,
    '<=': LessThanOrEqual,
    'array': Assertion,
    'at': At,
    'boolean': Assertion,
    'case': Case,
    'coalesce': Coalesce,
    'collator': CollatorExpression,
    'format': FormatExpression,
    'image': ImageExpression,
    'in': In,
    'index-of': IndexOf,
    'interpolate': Interpolate,
    'interpolate-hcl': Interpolate,
    'interpolate-lab': Interpolate,
    'length': Length,
    'let': Let,
    'literal': Literal,
    'match': Match,
    'number': Assertion,
    'number-format': NumberFormat,
    'object': Assertion,
    'slice': Slice,
    'step': Step,
    'string': Assertion,
    'to-boolean': Coercion,
    'to-color': Coercion,
    'to-number': Coercion,
    'to-string': Coercion,
    'var': Var,
    'within': Within,
    'distance': Distance,
    'config': Config
};

function rgba(ctx: EvaluationContext, [r, g, b, a]: Expression[]) {
    r = r.evaluate(ctx);
    g = g.evaluate(ctx);
    b = b.evaluate(ctx);
    const alpha = a ? a.evaluate(ctx) : 1;
    const error = validateRGBA(r, g, b, alpha);
    if (error) throw new RuntimeError(error);
    // @ts-expect-error
    return new Color(r / 255 * alpha, g / 255 * alpha, b / 255 * alpha, alpha);
}

function hsla(ctx: EvaluationContext, [h, s, l, a]: Expression[]) {
    h = h.evaluate(ctx);
    s = s.evaluate(ctx);
    l = l.evaluate(ctx);
    const alpha = a ? a.evaluate(ctx) : 1;
    const error = validateHSLA(h, s, l, alpha);
    if (error) throw new RuntimeError(error);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const colorFunction = `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    const color = Color.parse(colorFunction);
    if (!color) throw new RuntimeError(`Failed to parse HSLA color: ${colorFunction}`);
    return color;
}

function has(
    key: string,
    obj: {
        [key: string]: any;
    },
): boolean {
    return key in obj;
}

function get(key: string, obj: {
    [key: string]: any;
}) {
    const v = obj[key];
    return typeof v === 'undefined' ? null : v;
}

function binarySearch(v: any, a: {
    [key: number]: any;
}, i: number, j: number) {
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
            return v.evaluate(ctx).toRenderColor(null).toArray();
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
        (ctx, [k, v]) => ctx.properties()[(k).value] === (v).value
    ],
    'filter-id-==': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => ctx.id() === (v).value
    ],
    'filter-type-==': [
        BooleanType,
        [StringType],
        (ctx, [v]) => ctx.geometryType() === (v).value
    ],
    'filter-<': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k).value];
            const b = (v).value;
            return typeof a === typeof b && a < b;
        }
    ],
    'filter-id-<': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v).value;
            return typeof a === typeof b && a < b;
        }
    ],
    'filter->': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k).value];
            const b = (v).value;
            return typeof a === typeof b && a > b;
        }
    ],
    'filter-id->': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v).value;
            return typeof a === typeof b && a > b;
        }
    ],
    'filter-<=': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k).value];
            const b = (v).value;
            return typeof a === typeof b && a <= b;
        }
    ],
    'filter-id-<=': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v).value;
            return typeof a === typeof b && a <= b;
        }
    ],
    'filter->=': [
        BooleanType,
        [StringType, ValueType],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k).value];
            const b = (v).value;
            return typeof a === typeof b && a >= b;
        }
    ],
    'filter-id->=': [
        BooleanType,
        [ValueType],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v).value;
            return typeof a === typeof b && a >= b;
        }
    ],
    'filter-has': [
        BooleanType,
        [ValueType],
        (ctx, [k]) => (k).value in ctx.properties()
    ],
    'filter-has-id': [
        BooleanType,
        [],
        (ctx) => (ctx.id() !== null && ctx.id() !== undefined)
    ],
    'filter-type-in': [
        BooleanType,
        [array(StringType)],
        (ctx, [v]) => (v).value.indexOf(ctx.geometryType()) >= 0
    ],
    'filter-id-in': [
        BooleanType,
        [array(ValueType)],
        (ctx, [v]) => (v).value.indexOf(ctx.id()) >= 0
    ],
    'filter-in-small': [
        BooleanType,
        [StringType, array(ValueType)],
        // assumes v is an array literal
        (ctx, [k, v]) => (v).value.indexOf(ctx.properties()[(k).value]) >= 0
    ],
    'filter-in-large': [
        BooleanType,
        [StringType, array(ValueType)],
        // assumes v is a array literal with values sorted in ascending order and of a single type
        (ctx, [k, v]) => binarySearch(ctx.properties()[(k).value], (v).value, 0, (v).value.length - 1)
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
