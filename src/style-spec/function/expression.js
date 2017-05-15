'use strict';

const assert = require('assert');
const createFilter = require('../feature_filter');

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

function compile(expr) {
    if (
        !expr ||
        typeof expr === 'string' ||
        typeof expr === 'number' ||
        typeof expr === 'boolean'
    ) return {
        compiledExpression: JSON.stringify(expr),
        isFeatureConstant: true,
        isZoomConstant: true
    };

    if (expr.ref === 'feature') {
        return {
            compiledExpression: `
                ${JSON.stringify(expr.key)} in props ?
                    props[${JSON.stringify(expr.key)}] :
                    (${JSON.stringify(expr.defaultValue)} || 0)
            `,
            isFeatureConstant: false,
            isZoomConstant: true
        };
    }

    if (expr.ref === 'map') {
        return {
            compiledExpression: `mapProperties[${JSON.stringify(expr.key)}]`,
            isFeatureConstant: true,
            isZoomConstant: expr.key !== 'zoom'
        };
    }

    assert(Array.isArray(expr));

    const op = expr[0];

    // feature filter
    if (
        op === '==' ||
        op === '!=' ||
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ||
        op === 'any' ||
        op === 'all' ||
        op === 'none' ||
        op === 'in' ||
        op === '!in' ||
        op === 'has' ||
        op === '!has'
    ) {
        const featureFilter = createFilter(expr);
        return {
            compiledExpression: `(${featureFilter.toString()})(feature)`,
            isFeatureConstant: true,
            isZoomConstant: true
        };
    }

    const subExpressions = expr.slice(1);
    const args = subExpressions.map(compile).map(s => `(${s.compiledExpression})`);

    let compiled;
    if (op === 'concat') {
        compiled = `[${args.join(',')}].join('')`;
    } else if (op === '+' || op === '*') {
        compiled = args.join(op);
    } else if (op === 'if') {
        compiled = `${args[0]} ? ${args[1]} : ${args[2]}`;
    } else if (op === '-' || op === '/' || op === '%') {
        compiled = `${args[0]} ${op} ${args[1]}`;
    } else if (op === '^') {
        compiled = `Math.pow(${args[0]}, ${args[1]})`;
    }

    return {
        compiledExpression: compiled,
        isFeatureConstant: subExpressions.reduce((memo, e) => memo && e.isFeatureConstant, true),
        isZoomConstnat: subExpressions.reduce((memo, e) => memo && e.isZoomConstant, true)
    };
}

