'use strict';

const MapboxGLFunction = require('./style_function');
const parseColor = require('./parse_color');
const util = require('../util/util');
const interpolate = require('../util/interpolate');

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

    if (reference.function === 'piecewise-constant' && reference.transition) {
        this.calculate = wrapTransitionedCalculate(this.calculate);
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

// This function is used to smoothly transition between discrete values, such
// as images and dasharrays.
function wrapTransitionedCalculate(calculate) {
    return function(globalProperties, featureProperties, duration) {
        const z = globalProperties.zoom;
        const zh = globalProperties.zoomHistory;

        const fromScale = z > zh.lastIntegerZoom ? 2 : 0.5;
        const from = calculate({zoom: z > zh.lastIntegerZoom ? z - 1 : z + 1}, featureProperties);
        const to = calculate({zoom: z}, featureProperties);

        const timeFraction = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        const zoomFraction = Math.abs(z - zh.lastIntegerZoom);
        const t = interpolate(timeFraction, 1, zoomFraction);

        if (from === undefined || to === undefined)
            return undefined;

        return { from, fromScale, to, toScale: 1, t };
    };
}
