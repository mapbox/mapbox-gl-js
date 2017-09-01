// @flow

const assert = require('assert');
module.exports = compileExpression;

const {
    ParsingContext
} = require('./expression');
const parseExpression = require('./parse_expression');
const { CompoundExpression } = require('./compound_expression');
const definitions = require('./definitions');
const evaluationContext = require('./evaluation_context');

import type { Type } from './types.js';
import type { Expression, ParsingError } from './expression.js';

type CompileErrors = {|
    result: 'error',
    errors: Array<ParsingError>
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
    const context = new ParsingContext(definitions, [], expectedType || null);
    const parsed = parseExpression(expr, context);
    if (!parsed) {
        assert(context.errors.length > 0);
        return {
            result: 'error',
            errors: context.errors
        };
    }

    const compiled = parsed.compile();
    if (typeof compiled === 'string') {
        const fn = (new Function('$this', '$globalProperties', '$feature', `
$globalProperties = $globalProperties || {};
var $props = $feature && $feature.properties || {};
return $this.unwrap(${compiled})
`): any);

        const ctx = evaluationContext();

        return {
            result: 'success',
            function: (globalProperties, feature) =>
                fn(ctx, globalProperties, feature),
            functionSource: compiled,
            isFeatureConstant: isFeatureConstant(parsed),
            isZoomConstant: isZoomConstant(parsed),
            expression: parsed
        };
    }

    return {
        result: 'error',
        errors: compiled
    };
}

function isFeatureConstant(e: Expression) {
    let result = true;
    e.accept({
        visit: (expression) => {
            if (expression instanceof CompoundExpression) {
                if (expression.name === 'get') {
                    result = result && (expression.args.length > 1);
                } else if (expression.name === 'has') {
                    result = result && (expression.args.length > 1);
                } else {
                    result = result && !(
                        expression.name === 'properties' ||
                        expression.name === 'geometry-type' ||
                        expression.name === 'id'
                    );
                }
            }
        }
    });
    return result;
}

function isZoomConstant(e: Expression) {
    let result = true;
    e.accept({
        visit: (expression) => {
            if (expression.name === 'zoom') result = false;
        }
    });
    return result;
}
