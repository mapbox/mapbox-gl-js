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
const {success, error} = require('../util/result');

import type {Type} from './types';
import type {Value} from './values';
import type {Expression} from './expression';
import type {StylePropertySpecification} from '../style-spec';
import type {Result} from '../util/result';

export type Feature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[string]: any}
};

export type GlobalProperties = {
    zoom: number,
    heatmapDensity?: number
};

export type StyleExpression = {
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    parsed: Expression
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
                          options: {handleErrors?: boolean} = {}): Result<StyleExpression, Array<ParsingError>> {
    const parser = new ParsingContext(definitions, [], getExpectedType(propertySpec));
    const parsed = parser.parse(expression);
    if (!parsed) {
        assert(parser.errors.length > 0);
        return error(parser.errors);
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

    return success({ evaluate, parsed });
}

export type ConstantExpression = {
    kind: 'constant',
    evaluate: (globals: GlobalProperties, feature?: Feature) => any
};

export type SourceExpression = {
    kind: 'source',
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
};

export type CameraExpression = {
    kind: 'camera',
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    interpolationFactor: (input: number, lower: number, upper: number) => number,
    zoomStops: Array<number>
};

export type CompositeExpression = {
    kind: 'composite',
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    interpolationFactor: (input: number, lower: number, upper: number) => number,
    zoomStops: Array<number>
};

export type StylePropertyExpression =
    | ConstantExpression
    | SourceExpression
    | CameraExpression
    | CompositeExpression;

function createPropertyExpression(expression: mixed,
                                  propertySpec: StylePropertySpecification,
                                  options: {handleErrors?: boolean} = {}): Result<StylePropertyExpression, Array<ParsingError>> {
    expression = createExpression(expression, propertySpec, options);
    if (expression.result === 'error') {
        return expression;
    }

    const {evaluate, parsed} = expression.value;

    const isFeatureConstant = isConstant.isFeatureConstant(parsed);
    if (!isFeatureConstant && !propertySpec['property-function']) {
        return error([new ParsingError('', 'property expressions not supported')]);
    }

    const isZoomConstant = isConstant.isGlobalPropertyConstant(parsed, ['zoom']);
    if (!isZoomConstant && propertySpec['zoom-function'] === false) {
        return error([new ParsingError('', 'zoom expressions not supported')]);
    }

    const zoomCurve = findZoomCurve(parsed);
    if (!zoomCurve && !isZoomConstant) {
        return error([new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.')]);
    } else if (zoomCurve instanceof ParsingError) {
        return error([zoomCurve]);
    } else if (zoomCurve instanceof Interpolate && propertySpec['function'] === 'piecewise-constant') {
        return error([new ParsingError('', '"interpolate" expressions cannot be used with this property')]);
    }

    if (!zoomCurve) {
        return success(isFeatureConstant ?
            { kind: 'constant', parsed, evaluate } :
            { kind: 'source', parsed, evaluate });
    }

    const interpolationFactor = zoomCurve instanceof Interpolate ?
        Interpolate.interpolationFactor.bind(undefined, zoomCurve.interpolation) :
        () => 0;
    const zoomStops = zoomCurve.labels;

    return success(isFeatureConstant ?
        { kind: 'camera', parsed, evaluate, interpolationFactor, zoomStops } :
        { kind: 'composite', parsed, evaluate, interpolationFactor, zoomStops });
}

const {isFunction, createFunction} = require('../function');
const {Color} = require('./values');

function normalizePropertyExpression<T>(value: PropertyValueSpecification<T>, specification: StylePropertySpecification): StylePropertyExpression {
    if (isFunction(value)) {
        return createFunction(value, specification);

    } else if (isExpression(value)) {
        const expression = createPropertyExpression(value, specification);
        if (expression.result === 'error') {
            // this should have been caught in validation
            throw new Error(expression.value.map(err => `${err.key}: ${err.message}`).join(', '));
        }
        return expression.value;

    } else {
        let constant: any = value;
        if (typeof value === 'string' && specification.type === 'color') {
            constant = Color.parse(value);
        }
        return {
            kind: 'constant',
            evaluate: () => constant
        };
    }
}

module.exports = {
    isExpression,
    createExpression,
    createPropertyExpression,
    normalizePropertyExpression
};

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
            result = new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.');
        } else if (result && childResult && result !== childResult) {
            result = new ParsingError('', 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.');
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
