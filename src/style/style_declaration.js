// @flow

const parseColor = require('../style-spec/util/parse_color');
const {createExpressionWithErrorHandling, getExpectedType, getDefaultValue} = require('../style-spec/expression');
const createFunction = require('../style-spec/function');
const util = require('../util/util');
const Curve = require('../style-spec/expression/definitions/curve');

import type {StyleExpression, Feature, GlobalProperties} from '../style-spec/expression';

function normalizeToExpression(parameters, propertySpec, name): StyleExpression {
    if (typeof parameters === 'string' && propertySpec.type === 'color') {
        const color = parseColor(parameters);
        return {
            result: 'success',
            isFeatureConstant: true,
            isZoomConstant: true,
            evaluate() { return color; }
        };
    }

    if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
        return {
            result: 'success',
            isFeatureConstant: true,
            isZoomConstant: true,
            evaluate() { return parameters; }
        };
    }

    if (parameters.expression) {
        return createExpressionWithErrorHandling(
            parameters.expression,
            getExpectedType(propertySpec),
            getDefaultValue(propertySpec));
    } else {
        return createFunction(parameters, propertySpec, name);
    }
}

/**
 * A style property declaration
 * @private
 */
class StyleDeclaration {
    value: any;
    json: mixed;
    minimum: number;
    expression: StyleExpression;

    constructor(reference: any, value: any, name: string) {
        this.value = util.clone(value);

        // immutable representation of value. used for comparison
        this.json = JSON.stringify(this.value);

        this.minimum = reference.minimum;
        this.expression = normalizeToExpression(this.value, reference, name);
    }

    calculate(globals: GlobalProperties, feature?: Feature) {
        const value = this.expression.evaluate(globals, feature);
        if (this.minimum !== undefined && value < this.minimum) {
            return this.minimum;
        }
        return value;
    }

    /**
     * Calculate the interpolation factor for the given zoom stops and current
     * zoom level.
     */
    interpolationFactor(zoom: number, lower: number, upper: number) {
        if (this.expression.isZoomConstant) {
            return 0;
        } else {
            return Curve.interpolationFactor(
                this.expression.interpolation,
                zoom,
                lower,
                upper
            );
        }
    }
}

module.exports = StyleDeclaration;
