// @flow

const parseColor = require('../util/parse_color');
const compileExpression = require('./compile');
const convert = require('./convert');
const {
    ColorType,
    StringType,
    NumberType,
    BooleanType,
    ValueType,
    array
} = require('./types');
const {CompoundExpression} = require('./compound_expression');
const Curve = require('./definitions/curve');
const Coalesce = require('./definitions/coalesce');
const Let = require('./definitions/let');

import type {Expression} from './expression';

export type Feature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[string]: any}
};

export type StyleFunction = (globalProperties: {+zoom?: number}, feature?: Feature) => any;

type StylePropertySpecification = {
    type: 'number',
    default?: number
} | {
    type: 'string',
    default?: string
} | {
    type: 'boolean',
    default?: boolean
} | {
    type: 'enum',
    values: {[string]: {}},
    default?: string
} | {
    type: 'array',
    value: 'number' | 'string' | 'boolean',
    length?: number,
    default?: Array<mixed>
};

type StylePropertyValue = null | string | number | Array<string> | Array<number>;
type FunctionParameters = DataDrivenPropertyValueSpecification<StylePropertyValue>

function createFunction(parameters: FunctionParameters, propertySpec: StylePropertySpecification): StyleFunction {
    let expr;

    let defaultValue = propertySpec.default;
    let isConvertedStopFunction = false;
    if (!isFunctionDefinition(parameters)) {
        expr = convert.value(parameters, propertySpec);
        if (expr === null) {
            expr = getDefaultValue(propertySpec);
        }
    } else if (typeof parameters === 'object' && parameters !== null && typeof parameters.expression !== 'undefined') {
        expr = parameters.expression;
    } else {
        expr = convert.function(parameters, propertySpec);
        isConvertedStopFunction = true;
        if (parameters && typeof parameters.default !== 'undefined') {
            defaultValue = parameters.default;
        }
    }

    if (propertySpec.type === 'color') {
        defaultValue = parseColor((defaultValue: any));
    }

    let evaluate: StyleFunction;

    if (expr === null) {
        evaluate = function () { return defaultValue; };
        evaluate.isFeatureConstant = true;
        evaluate.isZoomConstant = true;
    } else {
        const expectedType = getExpectedType(propertySpec);
        const compiled = compileExpression(expr, expectedType);
        if (compiled.result === 'success') {
            const warningHistory: {[key: string]: boolean} = {};
            evaluate = function (globalProperties: {+zoom?: number}, feature?: Feature) {
                try {
                    const val = compiled.function(globalProperties, feature);
                    if (val === null || val === undefined) {
                        return defaultValue;
                    }
                    return val;
                } catch (e) {
                    if (!isConvertedStopFunction && !warningHistory[e.message]) {
                        warningHistory[e.message] = true;
                        if (typeof console !== 'undefined') {
                            console.warn(e.message);
                        }
                    }
                    return defaultValue;
                }
            };
            evaluate.isFeatureConstant = compiled.isFeatureConstant;
            evaluate.isZoomConstant = compiled.isZoomConstant;
            if (!evaluate.isZoomConstant) {
                // capture metadata from the curve definition that's needed for
                // our prepopulate-and-interpolate approach to paint properties
                // that are zoom-and-property dependent.
                evaluate.zoomCurve = findZoomCurve(compiled.expression);
                if (!(evaluate.zoomCurve instanceof Curve)) {
                    // should be prevented by validation.
                    throw new Error(evaluate.zoomCurve ? evaluate.zoomCurve.error : 'Invalid zoom expression');
                }
            }

        } else {
            // this should have been caught in validation
            throw new Error(compiled.errors.map(err => `${err.key}: ${err.message}`).join(', '));
        }
    }

    // useful for debugging, especially for converted stop functions
    evaluate.rawExpression = expr;

    return evaluate;
}

module.exports = createFunction;
module.exports.isFunctionDefinition = isFunctionDefinition;
module.exports.getExpectedType = getExpectedType;
module.exports.findZoomCurve = findZoomCurve;

// Zoom-dependent expressions may only use ["zoom"] as the input to a
// 'top-level' "curve" expression. (The curve may be wrapped in one or more
// "let" or "coalesce" expressions.)
function findZoomCurve(expression: Expression): null | Curve | {key: string, error: string} {
    if (expression instanceof Curve) {
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
            } else if (e instanceof Curve && !result) {
                result = e;
            } else {
                return {
                    key: e.key,
                    error: 'Only one zoom-based curve may be used in a style function.'
                };
            }
        }

        return result;
    } else {
        return null;
    }
}

function isFunctionDefinition(value: FunctionParameters): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    } else if (typeof value.expression !== 'undefined') {
        return true;
    } else {
        return Array.isArray(value.stops) ||
            (typeof value.type === 'string' && value.type === 'identity');
    }
}

function getDefaultValue(propertySpec) {
    return (typeof propertySpec.default !== 'undefined') ?
        convert.value(propertySpec.default, propertySpec) :
        ['error', 'No default property value available'];
}

function getExpectedType(spec) {
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

    return types[spec.type];
}

