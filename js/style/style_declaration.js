'use strict';

const MapboxGLFunction = require('./style_function');
const parseColor = require('./parse_color');
const util = require('../util/util');

module.exports = StyleDeclaration;

function StyleDeclaration(reference, value) {
    this.value = util.clone(value);
    this.isFunction = MapboxGLFunction.isFunctionDefinition(value);

    // immutable representation of value. used for comparison
    this.json = JSON.stringify(this.value);

    const parsedValue = reference.type === 'color' && this.value ? parseColor(this.value) : value;
    let specDefault = reference.default;
    if (specDefault && reference.type === 'color') specDefault = parseColor(specDefault);
    this.calculate = MapboxGLFunction[reference.function || 'piecewise-constant'](parsedValue);
    this.isFeatureConstant = this.calculate.isFeatureConstant;
    this.isZoomConstant = this.calculate.isZoomConstant;

    if (reference.type === 'color') {
        this.calculate = wrapColorCalculate(this.calculate);
    }

    if (!this.isFeatureConstant && !this.isZoomConstant) {
        this.stopZoomLevels = [];
        const interpolationAmountStops = [];
        const stops = this.value.stops;
        for (let i = 0; i < this.value.stops.length; i++) {
            const zoom = stops[i][0].zoom;
            if (this.stopZoomLevels.indexOf(zoom) < 0) {
                this.stopZoomLevels.push(zoom);
                interpolationAmountStops.push([zoom, interpolationAmountStops.length]);
            }
        }

        this.calculateInterpolationT = MapboxGLFunction.interpolated({
            stops: interpolationAmountStops,
            base: value.base,
            colorSpace: value.colorSpace
        });
    }
}

function wrapColorCalculate(calculate) {
    return function(globalProperties, featureProperties) {
        const color = calculate(globalProperties, featureProperties);
        return color && parseColor(color);
    };
}
