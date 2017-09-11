// @flow

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

    if (!isFunctionDefinition(parameters)) {
        expr = convert.value(parameters, propertySpec);
        if (expr === null) {
            expr = getDefaultValue(propertySpec);
        }
    } else if (typeof parameters === 'object' && parameters !== null && typeof parameters.expression !== 'undefined') {
        expr = ['coalesce', parameters.expression, getDefaultValue(propertySpec)];
    } else {
        expr = convert.function(parameters, propertySpec);
    }

    const expectedType = getExpectedType(propertySpec);
    const compiled = compileExpression(expr, expectedType);
    if (compiled.result === 'success') {
        const warningHistory: {[key: string]: boolean} = {};
        const f = function (globalProperties: {+zoom?: number}, feature?: Feature) {
            try {
                const val = compiled.function(globalProperties, feature);
                return val === null ? undefined : val;
            } catch (e) {
                if (!warningHistory[e.message]) {
                    warningHistory[e.message] = true;
                    if (typeof console !== 'undefined') console.warn(e.message);
                }
                return undefined;
            }
        };
        f.isFeatureConstant = compiled.isFeatureConstant;
        f.isZoomConstant = compiled.isZoomConstant;
        if (!f.isZoomConstant) {
            // capture metadata from the curve definition that's needed for
            // our prepopulate-and-interpolate approach to paint properties
            // that are zoom-and-property dependent.
            f.zoomCurve = findZoomCurve(compiled.expression);
            if (!(f.zoomCurve instanceof Curve)) {
                // should be prevented by validation.
                throw new Error(f.zoomCurve ? f.zoomCurve.error : 'Invalid zoom expression');
            }
        }

        // useful for debugging, especially for converted stop functions
        f.rawExpression = expr;
        return f;
    } else {
        throw new Error(compiled.errors.map(err => `${err.key}: ${err.message}`).join(', '));
    }
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

