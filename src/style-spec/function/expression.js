'use strict';

const assert = require('assert');

const Type = {
    None: 'none',
    Any: 'any',
    Number: 'number',
    String: 'string',
    Boolean: 'boolean',
    Color: 'color'
};

class NArgs {
    constructor(itemType) {
        this.itemType = itemType;
        this.isNArgs = true;
    }

    toString() {
        return `${this.itemType}, ${this.itemType}, ...`;
    }
}

Type.NArgs = {
    none: new NArgs(Type.None),
    any: new NArgs(Type.Any),
    number: new NArgs(Type.Number),
    string: new NArgs(Type.String),
    boolean: new NArgs(Type.Boolean),
    color: new NArgs(Type.Color)
};

module.exports = compileExpression;

/**
 *
 * Given a style function expression object, returns:
 * ```
 * {
 *   isFeatureConstant: boolean,
 *   isZoomConstant: boolean,
 *   expressionString: string,
 *   function: Function,
 *   errors: Array<{expression, error}>
 * }
 * ```
 *
 * @private
 */
function compileExpression(expr) {
    const compiled = compile(expr);
    if (compiled.errors.length === 0) {
        compiled.function = new Function('mapProperties', 'feature', `
mapProperties = mapProperties || {};
feature = feature || {};
var props = feature.properties || {};
return (${compiled.expressionString})
`);
    }
    return compiled;
}

const functions = {
    'ln2': {
        input: [],
        output: Type.Number,
    },
    'pi': {
        input: [],
        output: Type.Number,
    },
    'e': {
        input: [],
        output: Type.Number,
    },
    'zoom': {
        input: [],
        output: Type.Number,
    },
    'boolean_data': {
        input: [Type.String],
        output: Type.Boolean,
    },
    'string_data': {
        input: [Type.String],
        output: Type.String,
    },
    'number_data': {
        input: [Type.String],
        output: Type.Number,
    },
    'has': {
        input: [Type.String],
        output: Type.Boolean
    },
    'typeof': {
        input: [Type.String],
        output: Type.String
    },
    'geometry_type': {
        input: [],
        output: Type.String
    },
    'string_id': {
        input: [],
        output: Type.String
    },
    'number_id': {
        input: [],
        output: Type.Number
    },
    '+': {
        input: [Type.Number, Type.Number],
        output: Type.Number
    },
    '*': {
        input: [Type.Number, Type.Number],
        output: Type.Number
    },
    '-': {
        input: [Type.Number, Type.Number],
        output: Type.Number
    },
    '/': {
        input: [Type.Number, Type.Number],
        output: Type.Number
    },
    '^': {
        input: [Type.Number, Type.Number],
        output: Type.Number
    },
    '%': {
        input: [Type.Number, Type.Number],
        output: Type.Number
    },
    'log10': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'ln': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'log2': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'sin': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'cos': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'tan': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'asin': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'acos': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'atan': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'ceil': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'floor': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'round': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'abs': {
        input: [Type.Number],
        output: Type.Number,
        math: true
    },
    'min': {
        input: [Type.NArgs[Type.Number]],
        output: Type.Number,
        math: true
    },
    'max': {
        input: [Type.NArgs[Type.Number]],
        output: Type.Number,
        math: true
    },
    '==': {
        input: [Type.Any, Type.Any],
        output: Type.Boolean
    },
    '!=': {
        input: [Type.Any, Type.Any],
        output: Type.Boolean
    },
    '>': {
        input: [Type.Any, Type.Any],
        output: Type.Boolean
    },
    '<': {
        input: [Type.Any, Type.Any],
        output: Type.Boolean
    },
    '>=': {
        input: [Type.Any, Type.Any],
        output: Type.Boolean
    },
    '<=': {
        input: [Type.Any, Type.Any],
        output: Type.Number
    },
    '&&': {
        input: [Type.Boolean, Type.Boolean],
        output: Type.Boolean
    },
    '||': {
        input: [Type.Boolean, Type.Boolean],
        output: Type.Boolean
    },
    '!': {
        input: [Type.Boolean],
        output: [Type.Boolean]
    },
    'concat': {
        input: [Type.NArgs[Type.Any]],
        output: Type.String
    },
    'upcase': {
        input: [Type.String],
        output: Type.String
    },
    'downcase': {
        input: [Type.String],
        output: Type.String
    },
    'rgb': {
        input: [Type.Number, Type.Number, Type.Number],
        output: Type.Color
    },
    'rgba': {
        input: [Type.Number, Type.Number, Type.Number, Type.Number],
        output: Type.Color
    },
    'hsl': {
        input: [Type.Number, Type.Number, Type.Number],
        output: Type.Color
    },
    'hsla': {
        input: [Type.Number, Type.Number, Type.Number, Type.Number],
        output: Type.Color
    },
    'if': {
        input: [Type.Boolean, Type.Any, Type.Any],
        output: null // determined at type-check time
    }
};

function compile(expr) {
    if (!expr) return {
        expressionString: 'undefined',
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.None,
        errors: []
    };

    if (typeof expr === 'string') return {
        expressionString: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.String,
        errors: []
    };

    if (typeof expr === 'number') return {
        expressionString: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.Number,
        errors: []
    };

    if (typeof expr === 'boolean') return {
        expressionString: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.Boolean,
        errors: []
    };

    let compiled;
    const errors = [];

    assert(Array.isArray(expr));
    const op = expr[0];
    const argExpressions = expr.slice(1).map(compile);
    const args = argExpressions.map(s => `(${s.expressionString})`);

    if (!functions[op]) {
        errors.push({ expression: expr, error: `Unknown function ${op}`});
    }

    const type = checkType(expr, argExpressions.map(e => e.type), errors);

    if (argExpressions.some(s => !s.expressionString)) {
        return { errors, expression: expr };
    }

    let isFeatureConstant = argExpressions.reduce((memo, e) => memo && e.isFeatureConstant, true);
    let isZoomConstant = argExpressions.reduce((memo, e) => memo && e.isZoomConstant, true);

    if (op === 'e') {
        compiled = `Math.E`;
    } else if (op === 'ln2') {
        compiled = `Math.LN2`;
    } else if (op === 'pi') {
        compiled = `Math.PI`;
    } else if (op === 'number_data') {
        compiled = `Number(props[${args[0]}])`;
        isFeatureConstant = false;
    } else if (op === 'string_data') {
        compiled = `String(props[${args[0]}] || '')`;
        isFeatureConstant = false;
    } else if (op === 'boolean_data') {
        compiled = `Boolean(props[${args[0]}])`;
        isFeatureConstant = false;
    } else if (op === 'typeof') {
        compiled = `
            !(${args[0]} in props) ? 'none'
            : typeof props[${args[0]}] === 'number' ? 'number'
            : typeof props[${args[0]}] === 'string' ? 'string'
            : typeof props[${args[0]}] === 'boolean' ? 'boolean'
            : Array.isArray(props[${args[0]}]) ? 'array'
            : 'object'
        `;
        isFeatureConstant = false;
    } else if (op === 'has') {
        compiled = `${args[0]} in props`;
        isFeatureConstant = false;
    } else if (op === 'geometry_type') {
        compiled = `feature.geometry ? feature.geometry.type : undefined`;
    } else if (op === 'string_id') {
        compiled = 'String(feature.id || \'\')';
    } else if (op === 'number_id') {
        compiled = 'Number(feature.id)';
    } else if (op === 'zoom') {
        compiled = `mapProperties.zoom`;
        isZoomConstant = false;
    } else if (op === 'concat') {
        compiled = `[${args.join(',')}].join('')`;
    } else if (op === 'upcase') {
        compiled = `String(${args[0]}).toUpperCase()`;
    } else if (op === 'downcase') {
        compiled = `String(${args[0]}).toLowerCase()`;
    } else if (op === 'if') {
        compiled = `${args[0]} ? ${args[1]} : ${args[2]}`;
    } else if (op === '^') {
        compiled = `Math.pow(${args[0]}, ${args[1]})`;
    } else if (op === 'ln') {
        compiled = `Math.log(${args[0]})`;
    } else if (op === '!') {
        compiled = `!(${args[0]})`;
    } else if (functions[op].math) {
        compiled = `Math.${op}(${args.join(', ')})`;
    } else if (op === 'rgb' || op === 'rgba' || op === 'hsl' || op === 'hsla') {
        compiled = `"${op}(" + ${args.join(' + "," + ')} + ")"`;
    } else {
        compiled = args.join(op);
    }

    return {
        expressionString: compiled,
        errors,
        isFeatureConstant,
        isZoomConstant,
        type
    };
}

function checkType(expr, argTypes, errors) {
    const op = expr[0];
    const input = functions[op].input;
    let i = 0;
    for (const t of input) {
        if (t.isNArgs) {
            while (i < argTypes.length) {
                if (!match(t.itemType, argTypes[i]))
                    errors.push({expression: expr, error: `Expected ${t} but found ${argTypes[i]}`});
                i++;
            }
        } else {
            if (!match(t, argTypes[i]))
                errors.push({expression: expr, error: `Expected ${t} but found ${argTypes[i]}`});
            i++;
        }
    }

    if (op === 'if') {
        if (!match(argTypes[1], argTypes[2]))
            errors.push({expression: expr, error: `Expected both branches of 'if' to have the same type, but ${argTypes[1]} and ${argTypes[2]} do not match.`});
        return argTypes[1];
    } else if (
        op === '==' ||
        op === '!=' ||
        op === '>' ||
        op === '<' ||
        op === '>=' ||
        op === '<='
    ) {
        if (!match(argTypes[0], argTypes[1]))
            errors.push({expression: expr, error: `Comparison operator ${op} requires two expressions of matching types, but ${argTypes[0]} and ${argTypes[1]} do not match.`});
    }

    return functions[op].output;

    function match(t1, t2) {
        return t1 === Type.Any ||
            t2 === Type.Any ||
            t1 === t2;
    }
}

