// @flow

const assert = require('assert');
const ParsingError = require('./parsing_error');
const ParsingContext = require('./parsing_context');
const EvaluationContext = require('./evaluation_context');
const {CompoundExpression} = require('./compound_expression');
const Curve = require('./definitions/curve');
const Coalesce = require('./definitions/coalesce');
const Let = require('./definitions/let');
const definitions = require('./definitions');
const isConstant = require('./is_constant');
const {unwrap} = require('./values');
const extend = require('../util/extend');

import type {Type} from './types';
import type {Value} from './values';
import type {Expression} from './expression';
import type {InterpolationType} from './definitions/curve';

export type Feature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[string]: any}
};

export type GlobalProperties = {
    zoom: number,
    heatmapDensity?: number
};

export type StyleExpressionContext = 'declaration' | 'filter';

export type StyleExpressionOptions = {
    context: StyleExpressionContext,
    expectedType: Type | null,
    defaultValue?: Value | null
}

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
    context: 'declaration',
    isZoomConstant: false,
    isFeatureConstant: boolean,
    evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    // parsed: Expression,
    interpolation: InterpolationType,
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

type StylePropertyValue = null | string | number | Array<string> | Array<number>;
type FunctionParameters = DataDrivenPropertyValueSpecification<StylePropertyValue>

function createExpression(expression: mixed, options: StyleExpressionOptions): StyleExpressionErrors | StyleExpression {
    const parser = new ParsingContext(definitions, [], options.expectedType);
    const parsed = parser.parse(expression);
    if (!parsed) {
        assert(parser.errors.length > 0);
        return {
            result: 'error',
            errors: parser.errors
        };
    }

    const evaluator = new EvaluationContext();
    function evaluate(globals, feature) {
        evaluator.globals = globals;
        evaluator.feature = feature;
        return parsed.evaluate(evaluator);
    }

    const isFeatureConstant = isConstant.isFeatureConstant(parsed);
    const isZoomConstant = isConstant.isGlobalPropertyConstant(parsed, ['zoom']);

    if (isZoomConstant) {
        return {
            result: 'success',
            context: options.context,
            isZoomConstant: true,
            isFeatureConstant,
            evaluate,
            parsed
        };
    } else if (options.context === 'filter') {
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
            errors: [new ParsingError('', '"zoom" expression may only be used as input to a top-level "curve" expression.')]
        };
    } else if (!(zoomCurve instanceof Curve)) {
        return {
            result: 'error',
            errors: [new ParsingError(zoomCurve.key, zoomCurve.error)]
        };
    }

    return {
        result: 'success',
        context: 'declaration',
        isZoomConstant: false,
        isFeatureConstant,
        evaluate,
        parsed,

        // capture metadata from the curve definition that's needed for
        // our prepopulate-and-interpolate approach to paint properties
        // that are zoom-and-property dependent.
        interpolation: zoomCurve.interpolation,
        zoomStops: zoomCurve.labels
    };
}

function createExpressionWithErrorHandling(expression: mixed, options: StyleExpressionOptions): StyleExpression {
    expression = createExpression(expression, options);
    const defaultValue = options.defaultValue === undefined ? null : options.defaultValue;

    if (expression.result !== 'success') {
        // this should have been caught in validation
        throw new Error(expression.errors.map(err => `${err.key}: ${err.message}`).join(', '));
    }

    const evaluate = expression.evaluate;
    const warningHistory: {[key: string]: boolean} = {};

    return extend({}, expression, {
        evaluate(globals, feature) {
            try {
                const val = evaluate(globals, feature);
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
        }
    });
}

module.exports = createExpression;
module.exports.createExpressionWithErrorHandling = createExpressionWithErrorHandling;
module.exports.isExpression = isExpression;
module.exports.getExpectedType = getExpectedType;
module.exports.getDefaultValue = getDefaultValue;

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

function isExpression(value: FunctionParameters): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    } else if (typeof value.expression !== 'undefined') {
        return true;
    } else {
        return Array.isArray(value.stops) ||
            (typeof value.type === 'string' && value.type === 'identity');
    }
}

export type StylePropertySpecification = {
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
    default?: Array<Value>
} | {
    type: 'color',
    default?: string
};

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

const parseColor = require('../util/parse_color');
const {Color} = require('./values');

function getDefaultValue(spec: StylePropertySpecification): Value | null {
    const defaultValue = spec.default;
    if (spec.type === 'color') {
        const c: [number, number, number, number] = (parseColor((defaultValue: any)): any);
        assert(Array.isArray(c));
        return new Color(c[0], c[1], c[2], c[3]);
    }
    return defaultValue || null;
}
