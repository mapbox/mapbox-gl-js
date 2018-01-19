// @flow

const assert = require('assert');
const extend = require('../util/extend');
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
import type {InterpolationType} from './definitions/interpolate';

export type Feature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[string]: any}
};

export type GlobalProperties = {
    zoom: number,
    heatmapDensity?: number
};

class StyleExpression {
    expression: Expression;

    _evaluator: EvaluationContext;

    constructor(expression: Expression) {
        this.expression = expression;
    }

    evaluate(globals: GlobalProperties, feature?: Feature): any {
        if (!this._evaluator) {
            this._evaluator = new EvaluationContext();
        }

        this._evaluator.globals = globals;
        this._evaluator.feature = feature;
        return this.expression.evaluate(this._evaluator);
    }
}

class StyleExpressionWithErrorHandling extends StyleExpression {
    _defaultValue: Value;
    _warningHistory: {[key: string]: boolean};
    _enumValues: {[string]: any};

    _evaluator: EvaluationContext;

    constructor(expression: Expression, propertySpec: StylePropertySpecification) {
        super(expression);
        this._warningHistory = {};
        this._defaultValue = getDefaultValue(propertySpec);
        if (propertySpec.type === 'enum') {
            this._enumValues = propertySpec.values;
        }
    }

    evaluate(globals: GlobalProperties, feature?: Feature) {
        if (!this._evaluator) {
            this._evaluator = new EvaluationContext();
        }

        this._evaluator.globals = globals;
        this._evaluator.feature = feature;

        try {
            const val = this.expression.evaluate(this._evaluator);
            if (val === null || val === undefined) {
                return this._defaultValue;
            }
            if (this._enumValues && !(val in this._enumValues)) {
                throw new RuntimeError(`Expected value to be one of ${Object.keys(this._enumValues).map(v => JSON.stringify(v)).join(', ')}, but found ${JSON.stringify(val)} instead.`);
            }
            return val;
        } catch (e) {
            if (!this._warningHistory[e.message]) {
                this._warningHistory[e.message] = true;
                if (typeof console !== 'undefined') {
                    console.warn(e.message);
                }
            }
            return this._defaultValue;
        }
    }
}

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

    if (options.handleErrors === false) {
        return success(new StyleExpression(parsed));
    } else {
        return success(new StyleExpressionWithErrorHandling(parsed, propertySpec));
    }
}

class ZoomConstantExpression<Kind> {
    kind: Kind;
    _styleExpression: StyleExpression;
    constructor(kind: Kind, expression: StyleExpression) {
        this.kind = kind;
        this._styleExpression = expression;
    }
    evaluate(globals: GlobalProperties, feature?: Feature): any {
        return this._styleExpression.evaluate(globals, feature);
    }
}

class ZoomDependentExpression<Kind> {
    kind: Kind;
    zoomStops: Array<number>;

    _styleExpression: StyleExpression;
    _interpolationType: ?InterpolationType;

    constructor(kind: Kind, expression: StyleExpression, zoomCurve: Step | Interpolate) {
        this.kind = kind;
        this.zoomStops = zoomCurve.labels;
        this._styleExpression = expression;
        if (zoomCurve instanceof Interpolate) {
            this._interpolationType = zoomCurve.interpolation;
        }
    }

    evaluate(globals: GlobalProperties, feature?: Feature): any {
        return this._styleExpression.evaluate(globals, feature);
    }

    interpolationFactor(input: number, lower: number, upper: number): number {
        if (this._interpolationType) {
            return Interpolate.interpolationFactor(this._interpolationType, input, lower, upper);
        } else {
            return 0;
        }
    }
}

export type ConstantExpression = {
    kind: 'constant',
    +evaluate: (globals: GlobalProperties, feature?: Feature) => any,
}

export type SourceExpression = {
    kind: 'source',
    +evaluate: (globals: GlobalProperties, feature?: Feature) => any,
};

export type CameraExpression = {
    kind: 'camera',
    +evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    +interpolationFactor: (input: number, lower: number, upper: number) => number,
    zoomStops: Array<number>
};

export type CompositeExpression = {
    kind: 'composite',
    +evaluate: (globals: GlobalProperties, feature?: Feature) => any,
    +interpolationFactor: (input: number, lower: number, upper: number) => number,
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

    const parsed = expression.value.expression;

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
            (new ZoomConstantExpression('constant', expression.value): ConstantExpression) :
            (new ZoomConstantExpression('source', expression.value): SourceExpression));
    }

    return success(isFeatureConstant ?
        (new ZoomDependentExpression('camera', expression.value, zoomCurve): CameraExpression) :
        (new ZoomDependentExpression('composite', expression.value, zoomCurve): CompositeExpression));
}

const {isFunction, createFunction} = require('../function');
const {Color} = require('./values');

// serialization wrapper for old-style stop functions normalized to the
// expression interface
class StylePropertyFunction<T> {
    _parameters: PropertyValueSpecification<T>;
    _specification: StylePropertySpecification;

    kind: 'constant' | 'source' | 'camera' | 'composite';
    evaluate: (globals: GlobalProperties, feature?: Feature) => any;
    interpolationFactor: ?(input: number, lower: number, upper: number) => number;
    zoomStops: ?Array<number>;

    constructor(parameters: PropertyValueSpecification<T>, specification: StylePropertySpecification) {
        this._parameters = parameters;
        this._specification = specification;
        extend(this, createFunction(this._parameters, this._specification));
    }

    static deserialize(serialized: {_parameters: PropertyValueSpecification<T>, _specification: StylePropertySpecification}) {
        return ((new StylePropertyFunction(serialized._parameters, serialized._specification)): StylePropertyFunction<T>);
    }

    static serialize(input: StylePropertyFunction<T>) {
        return {
            _parameters: input._parameters,
            _specification: input._specification
        };
    }
}

function normalizePropertyExpression<T>(value: PropertyValueSpecification<T>, specification: StylePropertySpecification): StylePropertyExpression {
    if (isFunction(value)) {
        return (new StylePropertyFunction(value, specification): any);

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
    StyleExpression,
    StyleExpressionWithErrorHandling,
    isExpression,
    createExpression,
    createPropertyExpression,
    normalizePropertyExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    StylePropertyFunction
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
