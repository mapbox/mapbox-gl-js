// @flow

const assert = require('assert');
module.exports = compileExpression;

const {
    ParsingContext,
    CompilationContext
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

    const compilationContext = new CompilationContext();
    const compiled = compilationContext.compileToFunction(parsed, evaluationContext());

    return {
        result: 'success',
        function: compiled,
        functionSource: compilationContext.getPrelude(),
        isFeatureConstant: isFeatureConstant(parsed),
        isZoomConstant: isZoomConstant(parsed),
        expression: parsed
    };
}

function isFeatureConstant(e: Expression) {
    if (e instanceof CompoundExpression) {
        if (e.name === 'get' && e.args.length === 1) {
            return false;
        } else if (e.name === 'has' && e.args.length === 1) {
            return false;
        } else if (
            e.name === 'properties' ||
            e.name === 'geometry-type' ||
            e.name === 'id'
        ) {
            return false;
        }
    }

    let result = true;
    e.eachChild(arg => {
        if (result && !isFeatureConstant(arg)) { result = false; }
    });
    return result;
}

function isZoomConstant(e: Expression) {
    if (e instanceof CompoundExpression && e.name === 'zoom') { return false; }
    let result = true;
    e.eachChild((arg) => {
        if (result && !isZoomConstant(arg)) { result = false; }
    });
    return result;
}
