// @flow

const assert = require('assert');
module.exports = compileExpression;

const ParsingContext = require('./parsing_context');
const CompilationContext = require('./compilation_context');
const definitions = require('./definitions');
const {
    isFeatureConstant,
    isZoomConstant
} = require('./is_constant');

import type { Type } from './types.js';
import type { Expression } from './expression';
import type ParsingError from './parsing_error';

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
    const parsed = context.parse(expr);
    if (!parsed) {
        assert(context.errors.length > 0);
        return {
            result: 'error',
            errors: context.errors
        };
    }

    const compilationContext = new CompilationContext();
    const compiled = compilationContext.compileToFunction(parsed);

    return {
        result: 'success',
        function: compiled,
        functionSource: compilationContext.getPrelude(),
        isFeatureConstant: isFeatureConstant(parsed),
        isZoomConstant: isZoomConstant(parsed),
        expression: parsed
    };
}

