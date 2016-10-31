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

        const fraction = z % 1;
        const t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        let fromScale = 1;
        const toScale = 1;
        let mix, from, to;

        if (z > zh.lastIntegerZoom) {
            mix = fraction + (1 - fraction) * t;
            fromScale *= 2;
            from = calculate({zoom: z - 1}, featureProperties);
            to = calculate({zoom: z}, featureProperties);
        } else {
            mix = 1 - (1 - t) * fraction;
            to = calculate({zoom: z}, featureProperties);
            from = calculate({zoom: z + 1}, featureProperties);
            fromScale /= 2;
        }

        if (from === undefined || to === undefined) {
            return undefined;
        } else {
            return {
                from: from,
                fromScale: fromScale,
                to: to,
                toScale: toScale,
                t: mix
            };
        }
    };
}
