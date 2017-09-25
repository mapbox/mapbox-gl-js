// @flow

const createFunction = require('../style-spec/function');
const util = require('../util/util');
const Curve = require('../style-spec/function/definitions/curve');

import type {StyleFunction, Feature} from '../style-spec/function';

/**
 * A style property declaration
 * @private
 */
class StyleDeclaration {
    value: any;
    isFunction: boolean;
    isFeatureConstant: boolean;
    isZoomConstant: boolean;
    json: mixed;
    minimum: number;
    function: StyleFunction;
    stopZoomLevels: Array<number>;
    _zoomCurve: ?Curve;

    constructor(reference: any, value: any, name: string) {
        this.value = util.clone(value);
        this.isFunction = createFunction.isFunctionDefinition(value);

        // immutable representation of value. used for comparison
        this.json = JSON.stringify(this.value);

        this.minimum = reference.minimum;
        this.function = createFunction(this.value, reference, name);
        this.isFeatureConstant = this.function.isFeatureConstant;
        this.isZoomConstant = this.function.isZoomConstant;

        if (!this.isZoomConstant) {
            this._zoomCurve = this.function.zoomCurve;
            this.stopZoomLevels = [];
            for (const stop of this.function.zoomCurve.stops) {
                this.stopZoomLevels.push(stop[0]);
            }
        }
    }

    calculate(globalProperties: {+zoom?: number} = {}, feature?: Feature) {
        const value = this.function(globalProperties, feature);
        if (this.minimum !== undefined && value < this.minimum) {
            return this.minimum;
        }
        return value;
    }

    /**
     * Calculate the interpolation factor for the given zoom stops and current
     * zoom level.
     *
     * Only valid for composite functions.
     * @private
     */
    interpolationFactor(zoom: number, lower: number, upper: number) {
        if (!this._zoomCurve) return 0;
        return Curve.interpolationFactor(
            this._zoomCurve.interpolation,
            zoom,
            lower,
            upper
        );
    }
}

module.exports = StyleDeclaration;
