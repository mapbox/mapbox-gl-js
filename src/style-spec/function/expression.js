'use strict';

const assert = require('assert');

const Type = {
    None: {},
    Any: {},
    Number: {},
    String: {},
    Boolean: {},
    Color: {}
};

Type.Array = {
    [Type.Any]: {},
    [Type.Number]: {},
    [Type.String]: {},
    [Type.Boolean]: {},
    [Type.Color]: {}
};

module.exports = compileExpression;

function compileExpression(expr) {
    const compiled = compile(expr);
    const fun = new Function('mapProperties', 'feature', `
var props = (feature && feature.properties || {});
return (${compiled.compiledExpression})
`);
    fun.isFeatureConstant = compiled.isFeatureConstant;
    fun.isZoomConsant = compiled.isZoomConstant;
    return fun;
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
    'data': {
        input: [Type.String],
        output: Type.Any,
    },
    'has': {
        input: [Type.String],
        output: Type.Boolean
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
        input: [Type.Array[Type.Number]],
        output: Type.Number,
        math: true
    },
    'max': {
        input: [Type.Array[Type.Number]],
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
        input: [Type.Array[Type.Any]],
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
    'if': {
        input: [Type.Boolean, Type.Any, Type.Any],
        output: Type.Any
    }
};

function compile(expr) {
    if (!expr) return {
        compiledExpression: 'undefined',
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.None
    };

    if (typeof expr === 'string') return {
        compiledExpression: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.String
    };

    if (typeof expr === 'number') return {
        compiledExpression: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.Number
    };

    if (typeof expr === 'boolean') return {
        compiledExpression: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true,
        type: Type.Boolean
    };

    assert(Array.isArray(expr));
    const op = expr[0];
    const subExpressions = expr.slice(1).map(compile);
    const args = subExpressions.map(s => `(${s.compiledExpression})`);

    if (!functions[op]) {
        throw new Error(`Unknown function ${op}`);
    }

    checkArgumentTypes(functions[op].input, subExpressions);

    let compiled;
    let isFeatureConstant = subExpressions.reduce((memo, e) => memo && e.isFeatureConstant, true);
    let isZoomConstant = subExpressions.reduce((memo, e) => memo && e.isZoomConstant, true);

    if (op === 'e') {
        compiled = `Math.E`;
    } else if (op === 'ln2') {
        compiled = `Math.LN2`;
    } else if (op === 'pi') {
        compiled = `Math.PI`;
    } else if (op === 'data') {
        compiled = `props[${args[0]}]`;
        isFeatureConstant = false;
    } else if (op === 'zoom') {
        compiled = `mapProperties.zoom`;
        isZoomConstant = false;
    } else if (op === 'has') {
        compiled = `${args[0]} in props`;
        isFeatureConstant = false;
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
    } else {
        compiled = args.join(op);
    }

    return {
        compiledExpression: compiled,
        isFeatureConstant,
        isZoomConstant,
        type: functions[op].type
    };
}

function checkArgumentTypes() {
    // TODO
    return;
}

