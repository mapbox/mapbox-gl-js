'use strict';

const createFunction = require('../style-spec/function');
const util = require('../util/util');

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
            for (const stop of this.value.stops) {
                const zoom = stop[0].zoom;
                if (this.stopZoomLevels.indexOf(zoom) < 0) {
                    this.stopZoomLevels.push(zoom);
                    interpolationAmountStops.push([zoom, interpolationAmountStops.length]);
                }
            }

            this.functionInterpolationT = createFunction({
                type: 'exponential',
                stops: interpolationAmountStops,
                base: value.base
            }, {
                type: 'number'
            });
        }
    }

    calculate(globalProperties, featureProperties) {
        const value = this.function(globalProperties && globalProperties.zoom, featureProperties || {});
        if (this.minimum !== undefined && value < this.minimum) {
            return this.minimum;
        }
        return value;
    }

    calculateInterpolationT(globalProperties, featureProperties) {
        return this.functionInterpolationT(globalProperties && globalProperties.zoom, featureProperties || {});
    }
}

module.exports = StyleDeclaration;
