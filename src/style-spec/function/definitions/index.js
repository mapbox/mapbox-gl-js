// @flow

const assert = require('assert');

const {
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    typename,
    array
} = require('../types');

const {
    parseExpression,
    ParsingError,
    LambdaExpression,
    nargs
} = require('../expression');

const MatchExpression = require('./match');
const CurveExpression = require('./curve');

import type { Type } from '../types';
import type { ExpressionName } from '../expression_name';

const expressions: { [string]: Class<LambdaExpression> } = {
    'ln2': defineMathConstant('ln2'),
    'pi': defineMathConstant('pi'),
    'e': defineMathConstant('e'),

    'typeof': class TypeOf extends LambdaExpression {
        static opName() { return 'typeOf'; }
        static type() { return StringType; }
        static signatures() { return [[ValueType]]; }
        compileFromArgs(args) { return fromContext('typeOf', args); }
    },

    // type assertions
    'string': defineAssertion('string', StringType),
    'number': defineAssertion('number', NumberType),
    'boolean': defineAssertion('boolean', BooleanType),
    'object': defineAssertion('object', ObjectType),
    'array': class extends LambdaExpression {
        static opName() { return 'array'; }
        static signatures() { return [[ValueType]]; }
        static parse(args, context) {
            const types : {[string]:Type} = {
                string: StringType,
                number: NumberType,
                boolean: BooleanType
            };

            if (args.length === 0)
                throw new ParsingError(context.key, 'Expected at least one argument to "array"');

            const value = parseExpression(args[args.length - 1], context);

            let itemType = ValueType;
            let N;
            if (args.length > 1) {
                if (typeof args[0] !== 'string' || !types[args[0]])
                    throw new ParsingError(`${context.key}[1]`, `The item type argument to "array" must be one of ${Object.keys(types).join(', ')}`);
                itemType = types[args[0]];
            }
            if (args.length > 2) {
                if (typeof args[1] !== 'number')
                    throw new ParsingError(`${context.key}[2]`, 'The length argument to "array" must be a number literal.');
                N = args[1];
            }
            return new this(
                context.key,
                array(itemType, N),
                [value]
            );
        }

        compileFromArgs(args) {
            return `this.as(${args[args.length - 1]}, ${JSON.stringify(this.type.name)})`;
        }
    },

    // type coercion
    'to_string': class extends LambdaExpression {
        static opName() { return 'to_string'; }
        static type() { return StringType; }
        static signatures() { return [[ValueType]]; }
        compileFromArgs(args) {
            return `this.toString(${args[0]})`;
        }
    },
    'to_number': class extends LambdaExpression {
        static opName() { return 'to_number'; }
        static type() { return NumberType; }
        static signatures() { return [[ValueType]]; }
        compileFromArgs(args) {
            return `this.toNumber(${args[0]})`;
        }
    },
    'to_boolean': class extends LambdaExpression {
        static opName() { return 'to_boolean'; }
        static type() { return BooleanType; }
        static signatures() { return [[ValueType]]; }
        compileFromArgs(args) {
            return `Boolean(${args[0]})`;
        }
    },
    'to_rgba': class extends LambdaExpression {
        static opName() { return 'to_rgba'; }
        static type() { return array(NumberType, 4); }
        static signatures() { return [[ColorType]]; }
        compileFromArgs(args) {
            return `${args[0]}.value`;
        }
    },

    // color 'constructors'
    'parse_color': class extends LambdaExpression {
        static opName() { return 'parse_color'; }
        static type() { return ColorType; }
        static signatures() { return [[StringType]]; }
        compileFromArgs(args) { return fromContext('parseColor', args); }
    },
    'rgb': class extends LambdaExpression {
        static opName() { return 'rgb'; }
        static type() { return ColorType; }
        static signatures() { return [[NumberType, NumberType, NumberType]]; }
        compileFromArgs(args) { return fromContext('rgba', args); }
    },
    'rgba': class extends LambdaExpression {
        static opName() { return 'rgb'; }
        static type() { return ColorType; }
        static signatures() { return [[NumberType, NumberType, NumberType, NumberType]]; }
        compileFromArgs(args) { return fromContext('rgba', args); }
    },

    // object/array access
    'get': class extends LambdaExpression {
        static opName() { return 'get'; }
        static type() { return ValueType; }
        static signatures() { return [[StringType, nargs(1, ObjectType)]]; }
        compileFromArgs(args) {
            return `this.get(${args.length > 1 ? args[1] : 'props'}, ${args[0]}, ${args.length > 1 ? 'undefined' : '"feature.properties"'})`;
        }
    },
    'has': class extends LambdaExpression {
        static opName() { return 'has'; }
        static type() { return BooleanType; }
        static signatures() { return [[StringType, nargs(1, ObjectType)]]; }
        compileFromArgs(args) {
            return `this.has(${args.length > 1 ? args[1] : 'props'}, ${args[0]}, ${args.length > 1 ? 'undefined' : '"feature.properties"'})`;
        }
    },
    'at': class extends LambdaExpression {
        static opName() { return 'at'; }
        static type() { return typename('T'); }
        static signatures() { return [[NumberType, array(typename('T'))]]; }
        compileFromArgs(args) { return fromContext('at', args); }
    },
    'length': class extends LambdaExpression {
        static opName() { return 'length'; }
        static type() { return NumberType; }
        static signatures() {
            return [
                [array(typename('T'))],
                [StringType]
            ];
        }
        compileFromArgs(compiledArgs) {
            const t = this.args[0].type;
            assert(t.kind === 'array' || t.kind === 'primitive');
            return `${compiledArgs[0]}.length`;
        }
    },

    // // feature and map data
    'properties': class extends LambdaExpression {
        static opName() { return 'properties'; }
        static type() { return ObjectType; }
        static signatures() { return [[]]; }
        compile() {
            return 'this.as(props, "Object", "feature.properties")';
        }
    },
    'geometry_type': class extends LambdaExpression {
        static opName() { return 'geometry_type'; }
        static type() { return StringType; }
        static signatures() { return [[]]; }
        compile() {
            return 'this.get(this.get(feature, "geometry", "feature"), "type", "feature.geometry")';
        }
    },
    'id': class extends LambdaExpression {
        static opName() { return 'id'; }
        static type() { return ValueType; }
        static signatures() { return [[]]; }
        compile() {
            return 'this.get(feature, "id", "feature")';
        }
    },
    'zoom': class extends LambdaExpression {
        static opName() { return 'zoom'; }
        static type() { return NumberType; }
        static signatures() { return [[]]; }
        static parse(args, context) {
            const ancestors = context.ancestors.join(':');
            // zoom expressions may only appear like:
            // ['curve', interp, ['zoom'], ...]
            // or ['let', ..., ['coalesce', ['curve', interp, ['zoom'], ...], ... ] ]
            if (
                !/\[2\]$/.test(context.key) ||
                !/^(let\.result:|coalesce:)*curve$/.test(ancestors)
            ) {
                throw new ParsingError(
                    context.key,
                    'The "zoom" expression may only be used as the input to a top-level "curve" expression.'
                );
            }
            return super.parse(args, context);
        }
        compile() {
            return 'mapProperties.zoom';
        }
    },

    // math
    '+': defineBinaryMathOp('+', true),
    '*': defineBinaryMathOp('*', true),
    '-': defineBinaryMathOp('-'),
    '/': defineBinaryMathOp('/'),
    '%': defineBinaryMathOp('%'),
    '^': class extends LambdaExpression {
        static opName() { return '^'; }
        static type() { return NumberType; }
        static signatures() { return [[NumberType, NumberType]]; }
        compileFromArgs(args) {
            return `Math.pow(${args[0]}, ${args[1]})`;
        }
    },
    'log10': defineMathFunction('log10', 1),
    'ln': defineMathFunction('ln', 1, 'log'),
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
    '!': class extends LambdaExpression {
        static opName() { return '!'; }
        static type() { return BooleanType; }
        static signatures() { return [[BooleanType]]; }
        compileFromArgs(args) {
            return `!(${args[0]})`;
        }
    },

    // string manipulation
    'upcase': class extends LambdaExpression {
        static opName() { return 'upcase'; }
        static type() { return StringType; }
        static signatures() { return [[StringType]]; }
        compileFromArgs(args) {
            return `(${args[0]}).toUpperCase()`;
        }
    },
    'downcase': class extends LambdaExpression {
        static opName() { return 'downcase'; }
        static type() { return StringType; }
        static signatures() { return [[StringType]]; }
        compileFromArgs(args) {
            return `(${args[0]}).toLowerCase()`;
        }
    },
    'concat': class extends LambdaExpression {
        static opName() { return 'concat'; }
        static type() { return StringType; }
        static signatures() { return [[nargs(Infinity, ValueType)]]; }
        compileFromArgs(args) {
            return `[${args.join(', ')}].join('')`;
        }
    },

    // decisions
    'case': class extends LambdaExpression {
        static opName() { return 'case'; }
        static type() { return typename('T'); }
        static signatures() { return [[nargs(Infinity, BooleanType, typename('T')), typename('T')]]; }
        compileFromArgs(args) {
            const result = [];
            while (args.length > 1) {
                const c = args.splice(0, 2);
                result.push(`${c[0]} ? ${c[1]}`);
            }
            assert(args.length === 1); // enforced by type checking
            result.push(args[0]);
            return result.join(':');
        }
    },
    'match': MatchExpression,

    'coalesce': class extends LambdaExpression {
        static opName() { return 'coalesce'; }
        static type() { return typename('T'); }
        static signatures() { return [[nargs(Infinity, typename('T'))]]; }
        compileFromArgs(args) {
            return `this.coalesce(${args.map(a => `function () { return ${a} }.bind(this)`).join(', ')})`;
        }
    },

    'curve': CurveExpression
};

module.exports = expressions;

function defineMathConstant(name) {
    const mathName = name.toUpperCase();
    assert(typeof Math[mathName] === 'number');
    return class extends LambdaExpression {
        static opName() { return name; }
        static type() { return NumberType; }
        static signatures() { return [[]]; }
        compile() { return `Math.${mathName}`; }
    };
}

function defineMathFunction(name: ExpressionName, arity: number, mathName?: string) {
    const key:string = mathName || name;
    assert(typeof Math[key] === 'function');
    assert(arity > 0);
    const args = [];
    while (arity-- > 0) args.push(NumberType);
    return class extends LambdaExpression {
        static opName() { return name; }
        static type() { return NumberType; }
        static signatures() { return [args]; }
        compileFromArgs(args) {
            return `Math.${key}(${args.join(', ')})`;
        }
    };
}

function defineBinaryMathOp(name, isAssociative) {
    const args = isAssociative ? [nargs(Infinity, NumberType)] : [NumberType, NumberType];
    return class extends LambdaExpression {
        static opName() { return name; }
        static type() { return NumberType; }
        static signatures() { return [args]; }
        compileFromArgs(args) {
            return args.join(name);
        }
    };
}

function defineComparisonOp(name) {
    const op = name === '==' ? '===' :
        name === '!=' ? '!==' : name;
    return class extends LambdaExpression {
        static opName() { return name; }
        static type() { return BooleanType; }
        static signatures() { return [[typename('T'), typename('T')]]; }
        compileFromArgs(args) {
            return `${args[0]} ${op} ${args[1]}`;
        }
    };
}

function defineBooleanOp(op) {
    return class extends LambdaExpression {
        static opName() { return op; }
        static type() { return BooleanType; }
        static signatures() { return [[nargs(Infinity, BooleanType)]]; }
        compileFromArgs(args) {
            return `${args.join(op)}`;
        }
    };
}

function defineAssertion(name: ExpressionName, type: Type) {
    return class extends LambdaExpression {
        static opName() { return name; }
        static type() { return type; }
        static signatures() { return [[ValueType]]; }
        compileFromArgs(args) {
            return `this.as(${args[0]}, ${JSON.stringify(type.name)})`;
        }
    };
}

function fromContext(name: string, args: Array<string>) {
    return `this.${name}(${args.join(', ')})`;
}

