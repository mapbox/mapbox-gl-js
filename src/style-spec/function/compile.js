// @flow

const assert = require('assert');
module.exports = compileExpression;

const {
    parseExpression,
    ParsingContext,
    ParsingError,
    Scope
} = require('./expression');
const { CompoundExpression } = require('./compound_expression');
const { match } = require('./types');
const definitions = require('./definitions');
const evaluationContext = require('./evaluation_context');

import type { Type, TypeError } from './types.js';
import type { Expression } from './expression.js';

type CompileErrors = {|
    result: 'error',
    errors: Array<TypeError>
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

    const errors = [];
    const checked = parsed.typecheck(new Scope(), errors);
    if (!checked) {
        assert(errors.length > 0);
        return {
            result: 'error',
            errors
        };
    }

    if (expectedType) {
        const error = match(expectedType, checked.type);
        if (error) return {
            result: 'error',
            errors: [{key: '', error: error}]
        };
    }

    const compiled = checked.compile();
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
            isFeatureConstant: isFeatureConstant(checked),
            isZoomConstant: isZoomConstant(checked),
            expression: checked
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
        if (expression instanceof CompoundExpression) {
            if (expression.name === 'get') {
                result = result && (expression.args.length > 1);
            } else if (expression.name === 'has') {
                result = result && (expression.args.length > 1);
            } else {
                result = result && !(
                    expression.name === 'properties' ||
                    expression.name === 'geometry_type' ||
                    expression.name === 'id'
                );
            }
        }
    });
    return result;
}

function isZoomConstant(e: Expression) {
    let result = true;
    e.visit((expression) => {
        if (expression.name === 'zoom') result = false;
    });
    return result;
}
