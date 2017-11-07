// @flow

const Color = require('../style-spec/util/color');
const {isFunction, createFunction} = require('../style-spec/function');
const {isExpression, createPropertyExpression} = require('../style-spec/expression');
const util = require('../util/util');

import type {StylePropertyExpression, Feature, GlobalProperties} from '../style-spec/expression';

function normalizeToExpression(parameters, propertySpec): StylePropertyExpression {
    if (isFunction(parameters)) {
        return createFunction(parameters, propertySpec);
    } else if (isExpression(parameters)) {
        const expression = createPropertyExpression(parameters, propertySpec);
        if (expression.result === 'error') {
            // this should have been caught in validation
            throw new Error(expression.errors.map(err => `${err.key}: ${err.message}`).join(', '));
        }
        return expression;
    } else {
        if (typeof parameters === 'string' && propertySpec.type === 'color') {
            parameters = Color.parse(parameters);
        }
        return {
            result: 'constant',
            evaluate: () => parameters
        };
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
    expression: StylePropertyExpression;

    constructor(reference: any, value: any) {
        this.value = util.clone(value);

        // immutable representation of value. used for comparison
        this.json = JSON.stringify(this.value);

        this.minimum = reference.minimum;
        this.expression = normalizeToExpression(this.value, reference);
    }

    isFeatureConstant() {
        return this.expression.result === 'constant' || this.expression.result === 'camera';
    }

    isZoomConstant() {
        return this.expression.result === 'constant' || this.expression.result === 'source';
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
        if (this.expression.result === 'constant' || this.expression.result === 'source') {
            return 0;
        } else {
            return this.expression.interpolationFactor(zoom, lower, upper);
        }
    }
}

module.exports = StyleDeclaration;
