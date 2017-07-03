// @flow

module.exports = compileExpression;

const {
    parseExpression,
    ParsingContext,
    ParsingError
} = require('./expression');
const definitions = require('./definitions');
const typecheck = require('./type_check');
const evaluationContext = require('./evaluation_context');

import type { Type } from './types.js';
import type { Expression, CompileError } from './expression.js';

type CompileErrors = {|
    result: 'error',
    errors: Array<CompileError>
|}

type CompiledExpression = {|
    result: 'success',
    function: Function,
    functionSource: string,
    isFeatureConstant: boolean,
    isZoomConstant: boolean,
    expression: Expression
|}

/**
 *
 * Given a style function expression object, returns:
 * ```
 * {
 *   result: 'success',
 *   isFeatureConstant: boolean,
 *   isZoomConstant: boolean,
 *   function: Function
 * }
 * ```
 * or else
 *
 * ```
 * {
 *   result: 'error',
 *   errors: Array<CompileError>
 * }
 * ```
 *
 * @private
 */
function compileExpression(
    expr: mixed,
    expectedType?: Type
): CompiledExpression | CompileErrors {
    let parsed;
    try {
        parsed = parseExpression(expr, new ParsingContext(definitions));
    } catch (e) {
        if (e instanceof ParsingError) {
            return {
                result: 'error',
                errors: [{key: e.key, error: e.message}]
            };
        }
        throw e;
    }

    const checked = typecheck(expectedType || parsed.type, parsed);
    if (checked.result === 'error') {
        return checked;
    }

    const compiled = checked.expression.compile();
    if (typeof compiled === 'string') {
        const fn = new Function('mapProperties', 'feature', `
mapProperties = mapProperties || {};
var props = feature && feature.properties || {};
return this.unwrap(${compiled})
`);

        return {
            result: 'success',
            function: fn.bind(evaluationContext()),
            functionSource: compiled,
            isFeatureConstant: isFeatureConstant(checked.expression),
            isZoomConstant: isZoomConstant(checked.expression),
            expression: checked.expression
        };
    }

    return {
        result: 'error',
        errors: compiled
    };
}

function isFeatureConstant(e: Expression) {
    let result = true;
    e.visit((expression) => {
        if (expression instanceof definitions['get']) {
            result = result && (expression.args.length > 1);
        } else if (expression instanceof definitions['has']) {
            result = result && (expression.args.length > 1);
        } else {
            result = result && !(
                expression instanceof definitions['properties'] ||
                expression instanceof definitions['geometry_type'] ||
                expression instanceof definitions['id']
            );
        }
    });
    return result;
}

function isZoomConstant(e: Expression) {
    let result = true;
    e.visit((expression) => {
        if (expression instanceof definitions['zoom']) result = false;
    });
    return result;
}
