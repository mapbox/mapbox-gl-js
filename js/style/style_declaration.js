'use strict';

const MapboxGLFunction = require('mapbox-gl-function');
const parseColor = require('./parse_color');
const util = require('../util/util');

class StyleDeclaration {

    constructor(reference, value) {
        this.value = util.clone(value);
        this.isFunction = MapboxGLFunction.isFunctionDefinition(value);

        // immutable representation of value. used for comparison
        this.json = JSON.stringify(this.value);

        this.isColor = reference.type === 'color';

        const parsedValue = this.isColor && this.value ? parseColor(this.value) : value;
        let specDefault = reference.default;
        if (specDefault && reference.type === 'color') specDefault = parseColor(specDefault);

        this.function = MapboxGLFunction[reference.function || 'piecewise-constant'](parsedValue, specDefault);
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

            this.functionInterpolationT = MapboxGLFunction.interpolated({
                stops: interpolationAmountStops,
                base: value.base,
                colorSpace: value.colorSpace
            });
        }
    }

    calculate(globalProperties, featureProperties) {
        const value = this.function(globalProperties && globalProperties.zoom, featureProperties || {});
        if (this.isColor && value) {
            return parseColor(value);
        }
        return value;
    }

    calculateInterpolationT(globalProperties, featureProperties) {
        return this.functionInterpolationT(globalProperties && globalProperties.zoom, featureProperties || {});
    }
}

module.exports = StyleDeclaration;
