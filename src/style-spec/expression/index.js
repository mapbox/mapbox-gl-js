// @flow

const assert = require('assert');
const ParsingError = require('./parsing_error');
const ParsingContext = require('./parsing_context');
const EvaluationContext = require('./evaluation_context');
const {CompoundExpression} = require('./compound_expression');
const Step = require('./definitions/step');
const Interpolate = require('./definitions/interpolate');
const Coalesce = require('./definitions/coalesce');
const Let = require('./definitions/let');
const definitions = require('./definitions');
const isConstant = require('./is_constant');
const RuntimeError = require('./runtime_error');

import type {Type} from './types';
import type {Value} from './values';
import type {Expression} from './expression';
import type {StylePropertySpecification} from '../style-spec';

export type Feature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[string]: any}
};

export type GlobalProperties = {
    zoom: number,
    heatmapDensity?: number
};

export type StyleExpressionContext = 'property' | 'filter';

export type StyleExpressionErrors = {
    result: 'error',
    errors: Array<ParsingError>
};

type ZoomConstantExpression = {
    result: 'success',
    context: StyleExpressionContext,
    isZoomConstant: true,
    isFeatureConstant: boolean,
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    // parsed: Expression
};

export type StyleDeclarationExpression = ZoomConstantExpression | {
    result: 'success',
    context: 'property',
    isZoomConstant: false,
    isFeatureConstant: boolean,
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    // parsed: Expression,
    interpolationFactor: (input: number, lower: number, upper: number) => number,
    zoomStops: Array<number>
};

export type StyleFilterExpression = ZoomConstantExpression | {
    result: 'success',
    context: 'filter',
    isZoomConstant: false,
    isFeatureConstant: boolean,
    evaluate: (GlobalProperties, feature?: Feature) => any,
    // parsed: Expression,
};

export type StyleExpression = StyleDeclarationExpression | StyleFilterExpression;

function isExpression(expression: mixed) {
    return Array.isArray(expression) && expression.length > 0 &&
        typeof expression[0] === 'string' && expression[0] in definitions;
}

/**
 * Parse and typecheck the given style spec JSON expression.  If
 * options.defaultValue is provided, then the resulting StyleExpression's
 * `evaluate()` method will handle errors by logging a warning (once per
 * message) and returning the default value.  Otherwise, it will throw
 * evaluation errors.
 *
 * @private
 */
function createExpression(expression: mixed,
                          propertySpec: StylePropertySpecification,
                          context: StyleExpressionContext,
                          options: {handleErrors?: boolean} = {}): StyleExpressionErrors | StyleExpression {
    const parser = new ParsingContext(definitions, [], getExpectedType(propertySpec));
    const parsed = parser.parse(expression);
    if (!parsed) {
        assert(parser.errors.length > 0);
        return {
            result: 'error',
            errors: parser.errors
        };
    }

    const evaluator = new EvaluationContext();

    let evaluate;
    if (options.handleErrors === false) {
        evaluate = function (globals, feature) {
            evaluator.globals = globals;
            evaluator.feature = feature;
            return parsed.evaluate(evaluator);
        };
    } else {
        const warningHistory: {[key: string]: boolean} = {};
        const defaultValue = getDefaultValue(propertySpec);
        let enumValues;
        if (propertySpec.type === 'enum') {
            enumValues = propertySpec.values;
        }
        evaluate = function (globals, feature) {
            evaluator.globals = globals;
            evaluator.feature = feature;
            try {
                const val = parsed.evaluate(evaluator);
                if (val === null || val === undefined) {
                    return defaultValue;
                }
                if (enumValues && !(val in enumValues)) {
                    throw new RuntimeError(`Expected value to be one of ${Object.keys(enumValues).map(v => JSON.stringify(v)).join(', ')}, but found ${JSON.stringify(val)} instead.`);
                }
                return val;
            } catch (e) {
                if (!warningHistory[e.message]) {
                    warningHistory[e.message] = true;
                    if (typeof console !== 'undefined') {
                        console.warn(e.message);
                    }
                }
                return defaultValue;
            }
        };
    }

    const isFeatureConstant = isConstant.isFeatureConstant(parsed);
    if (!isFeatureConstant && context === 'property' && !propertySpec['property-function']) {
        return {
            result: 'error',
            errors: [new ParsingError('', 'property expressions not supported')]
        };
    }

    const isZoomConstant = isConstant.isGlobalPropertyConstant(parsed, ['zoom']);
    if (isZoomConstant) {
        return {
            result: 'success',
            context: context,
            isZoomConstant: true,
            isFeatureConstant,
            evaluate,
            parsed
        };
    } else if (context === 'filter') {
        return {
            result: 'success',
            context: 'filter',
            isZoomConstant: false,
            isFeatureConstant,
            evaluate,
            parsed
        };
    }

    const zoomCurve = findZoomCurve(parsed);
    if (!zoomCurve) {
        assert(false); // Unreachable: we don't call findZoomCurve unless there's a zoom expression.
        return {
            result: 'error',
            errors: []
        };
    } else if (zoomCurve instanceof ParsingError) {
        return {
            result: 'error',
            errors: [zoomCurve]
        };
    } else if (zoomCurve instanceof Interpolate && propertySpec['function'] === 'piecewise-constant') {
        return {
            result: 'error',
            errors: [new ParsingError(zoomCurve.key, '"interpolate" expressions cannot be used with this property')]
        };
    }

    return {
        result: 'success',
        context: 'property',
        isZoomConstant: false,
        isFeatureConstant,
        evaluate,
        parsed,

        // capture metadata from the curve definition that's needed for
        // our prepopulate-and-interpolate approach to paint properties
        // that are zoom-and-property dependent.
        interpolationFactor: zoomCurve instanceof Interpolate ?
            Interpolate.interpolationFactor.bind(undefined, zoomCurve.interpolation) :
            () => 0,
        zoomStops: zoomCurve.labels
    };
}

module.exports.createExpression = createExpression;
module.exports.isExpression = isExpression;

// Zoom-dependent expressions may only use ["zoom"] as the input to a top-level "step" or "interpolate"
// expression (collectively referred to as a "curve"). The curve may be wrapped in one or more "let" or
// "coalesce" expressions.
function findZoomCurve(expression: Expression): Step | Interpolate | ParsingError | null {
    let result = null;
    if (expression instanceof Let) {
        result = findZoomCurve(expression.result);

    } else if (expression instanceof Coalesce) {
        for (const arg of expression.args) {
            result = findZoomCurve(arg);
            if (result) {
                break;
            }
        }

    } else if ((expression instanceof Step || expression instanceof Interpolate) &&
        expression.input instanceof CompoundExpression &&
        expression.input.name === 'zoom') {

        result = expression;
    }

    if (result instanceof ParsingError) {
        return result;
    }

    expression.eachChild((child) => {
        const childResult = findZoomCurve(child);
        if (childResult instanceof ParsingError) {
            result = childResult;
        } else if (!result && childResult) {
            result = new ParsingError(childResult.key, '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.');
        } else if (result && childResult && result !== childResult) {
            result = new ParsingError(childResult.key, 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.');
        }
    });

    return result;
}

const {
    ColorType,
    StringType,
    NumberType,
    BooleanType,
    ValueType,
    array
} = require('./types');

function getExpectedType(spec: StylePropertySpecification): Type | null {
    const types = {
        color: ColorType,
        string: StringType,
        number: NumberType,
        enum: StringType,
        boolean: BooleanType
    };

    if (spec.type === 'array') {
        return array(types[spec.value] || ValueType, spec.length);
    }

    return types[spec.type] || null;
}

const {isFunction} = require('../function');
const {Color} = require('./values');

function getDefaultValue(spec: StylePropertySpecification): Value {
    if (spec.type === 'color' && isFunction(spec.default)) {
        // Special case for heatmap-color: it uses the 'default:' to define a
        // default color ramp, but createExpression expects a simple value to fall
        // back to in case of runtime errors
        return new Color(0, 0, 0, 0);
    } else if (spec.type === 'color') {
        return Color.parse(spec.default) || null;
    } else if (spec.default === undefined) {
        return null;
    } else {
        return spec.default;
    }
}
