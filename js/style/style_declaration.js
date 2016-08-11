'use strict';

var MapboxGLFunction = require('./style_function');
var parseColor = require('./parse_color');
var util = require('../util/util');

module.exports = StyleDeclaration;

function StyleDeclaration(reference, value) {
    this.value = util.clone(value);
    this.isFunction = MapboxGLFunction.isFunctionDefinition(value);

    // immutable representation of value. used for comparison
    this.json = JSON.stringify(this.value);

    var parsedValue = reference.type === 'color' && this.value ? parseColor(this.value) : value;
    this.calculate = MapboxGLFunction[reference.function || 'piecewise-constant'](parsedValue);
    this.isFeatureConstant = this.calculate.isFeatureConstant;
    this.isZoomConstant = this.calculate.isZoomConstant;

    if (reference.function === 'piecewise-constant' && reference.transition) {
        this.calculate = transitioned(this.calculate);
    }

    if (!this.isFeatureConstant && !this.isZoomConstant) {
        this.stopZoomLevels = [];
        var interpolationAmountStops = [];
        var stops = this.value.stops;
        for (var i = 0; i < this.value.stops.length; i++) {
            var zoom = stops[i][0].zoom;
            if (this.stopZoomLevels.indexOf(zoom) < 0) {
                this.stopZoomLevels.push(zoom);
                interpolationAmountStops.push([zoom, interpolationAmountStops.length]);
            }
        }

        this.calculateInterpolationT = MapboxGLFunction.interpolated({
            stops: interpolationAmountStops,
            base: value.base
        });
    }
}

// This function is used to smoothly transition between discrete values, such
// as images and dasharrays.
function transitioned(calculate) {
    return function(globalProperties, featureProperties) {
        var z = globalProperties.zoom;
        var zh = globalProperties.zoomHistory;
        var duration = globalProperties.duration;

        var fraction = z % 1;
        var t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        var fromScale = 1;
        var toScale = 1;
        var mix, from, to;

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
