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
const {unwrap} = require('./values');

import type {Type} from './types';
import type {Value} from './values';
import type {Expression} from './expression';

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

export type StylePropertySpecification = {
    type: 'number',
    'function': boolean,
    'property-function': boolean,
    default?: number
} | {
    type: 'string',
    'function': boolean,
    'property-function': boolean,
    default?: string
} | {
    type: 'boolean',
    'function': boolean,
    'property-function': boolean,
    default?: boolean
} | {
    type: 'enum',
    'function': boolean,
    'property-function': boolean,
    values: {[string]: {}},
    default?: string
} | {
    type: 'array',
    'function': boolean,
    'property-function': boolean,
    value: 'number' | 'string' | 'boolean',
    length?: number,
    default?: Array<Value>
} | {
    type: 'color',
    'function': boolean,
    'property-function': boolean,
    default?: string
};

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
        evaluate = function (globals, feature) {
            evaluator.globals = globals;
            evaluator.feature = feature;
            try {
                const val = parsed.evaluate(evaluator);
                if (val === null || val === undefined) {
                    return unwrap(defaultValue);
                }
                return unwrap(val);
            } catch (e) {
                if (!warningHistory[e.message]) {
                    warningHistory[e.message] = true;
                    if (typeof console !== 'undefined') {
                        console.warn(e.message);
                    }
                }
                return unwrap(defaultValue);
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
        return {
            result: 'error',
            errors: [new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.')]
        };
    } else if (!(zoomCurve instanceof Step || zoomCurve instanceof Interpolate)) {
        return {
            result: 'error',
            errors: [new ParsingError(zoomCurve.key, zoomCurve.error)]
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
function findZoomCurve(expression: Expression): null | Step | Interpolate | {key: string, error: string} {
    if (expression instanceof Step || expression instanceof Interpolate) {
        const input = expression.input;
        if (input instanceof CompoundExpression && input.name === 'zoom') {
            return expression;
        } else {
            return null;
        }
    } else if (expression instanceof Let) {
        return findZoomCurve(expression.result);
    } else if (expression instanceof Coalesce) {
        let result = null;
        for (const arg of expression.args) {
            const e = findZoomCurve(arg);
            if (!e) {
                continue;
            } else if (e.error) {
                return e;
            } else if ((e instanceof Step || e instanceof Interpolate) && !result) {
                result = e;
            } else {
                return {
                    key: e.key,
                    error: 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.'
                };
            }
        }

        return result;
    } else {
        return null;
    }
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
const parseColor = require('../util/parse_color');
const {Color} = require('./values');

function getDefaultValue(spec: StylePropertySpecification): Value | null {
    const defaultValue = spec.default;
    if (spec.type === 'color' && isFunction(defaultValue)) {
        // Special case for heatmap-color: it uses the 'default:' to define a
        // default color ramp, but createExpression expects a simple value to fall
        // back to in case of runtime errors
        return [0, 0, 0, 0];
    } else if (spec.type === 'color') {
        const c: [number, number, number, number] = (parseColor((defaultValue: any)): any);
        assert(Array.isArray(c));
        return new Color(c[0], c[1], c[2], c[3]);
    }
    return defaultValue === undefined ? null : defaultValue;
}
