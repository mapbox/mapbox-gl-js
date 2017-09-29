// @flow

const createFunction = require('../style-spec/expression');
const util = require('../util/util');
const Curve = require('../style-spec/expression/definitions/curve');

import type {StyleFunction, Feature} from '../style-spec/expression';

/**
 * A style property declaration
 * @private
 */
class StyleDeclaration {
    value: any;
    isFunction: boolean;
    json: mixed;
    minimum: number;
    function: StyleFunction;

    constructor(reference: any, value: any) {
        this.value = util.clone(value);
        this.isFunction = createFunction.isFunctionDefinition(value);

        // immutable representation of value. used for comparison
        this.json = JSON.stringify(this.value);

        this.minimum = reference.minimum;
        this.function = createFunction(this.value, reference);
    }

    calculate(globalProperties: {+zoom?: number} = {}, feature?: Feature) {
        const value = this.function.evaluate(globalProperties, feature);
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
        if (this.function.isZoomConstant) {
            return 0;
        } else {
            return Curve.interpolationFactor(
                this.function.zoomCurve.interpolation,
                zoom,
                lower,
                upper
            );
        }
    }
}

module.exports = StyleDeclaration;
