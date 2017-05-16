'use strict';

const createFunction = require('../style-spec/function');
const util = require('../util/util');

/**
 * A style property declaration
 * @private
 */
class StyleDeclaration {

    constructor(reference, value) {
        this.value = util.clone(value);
        this.isFunction = createFunction.isFunctionDefinition(value);

        // immutable representation of value. used for comparison
        this.json = JSON.stringify(this.value);

        this.minimum = reference.minimum;
        this.function = createFunction(this.value, reference);
        this.isFeatureConstant = this.function.isFeatureConstant;
        this.isZoomConstant = this.function.isZoomConstant;

        if (!this.isFeatureConstant && !this.isZoomConstant) {
            this.stopZoomLevels = [];
            const interpolationAmountStops = [];

            let base;
            if (this.value.type === 'expression') {
                // generate "pseudo stops" for the function expression at
                // integer zoom levels so that we can interpolate the
                // render-time value the same way as for stop-based functions.
                base = this.value.zoomInterpolationBase || 1;
                for (let z = 0; z < 30; z++) {
                    this.stopZoomLevels.push(z);
                    interpolationAmountStops.push([z, interpolationAmountStops.length]);
                }
            } else {
                base = this.value.base;
                for (const stop of this.value.stops) {
                    const zoom = stop[0].zoom;
                    if (this.stopZoomLevels.indexOf(zoom) < 0) {
                        this.stopZoomLevels.push(zoom);
                        interpolationAmountStops.push([zoom, interpolationAmountStops.length]);
                    }
                }
            }

            this._functionInterpolationT = createFunction({
                type: 'exponential',
                stops: interpolationAmountStops,
                base: base
            }, {
                type: 'number'
            });
        } else if (!this.isZoomConstant) {
            this.stopZoomLevels = [];
            for (const stop of this.value.stops) {
                if (this.stopZoomLevels.indexOf(stop[0]) < 0) {
                    this.stopZoomLevels.push(stop[0]);
                }
            }
        }
    }

    calculate(globalProperties, featureProperties) {
        const value = this.function(globalProperties && globalProperties.zoom, featureProperties || {});
        if (this.minimum !== undefined && value < this.minimum) {
            return this.minimum;
        }
        return value;
    }

    /**
     * Given a zoom level, calculate a possibly-fractional "index" into the
     * composite function stops array, intended to be used for interpolating
     * between paint values that have been evaluated at the surrounding stop
     * values.
     *
     * Only valid for composite functions.
     * @private
     */
    calculateInterpolationT(globalProperties) {
        if (this.isFeatureConstant || this.isZoomConstant) return 0;
        return this._functionInterpolationT(globalProperties && globalProperties.zoom, {});
    }
}

module.exports = StyleDeclaration;
