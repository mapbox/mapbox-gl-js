'use strict';

var MapboxGLFunction = require('./style_function');
var parseColor = require('./parse_color');

module.exports = StyleDeclaration;

function StyleDeclaration(reference, value) {
    this.type = reference.type;
    this.transitionable = reference.transition;
    this.value = value;
    this.isFunction = !!value.stops;

    // immutable representation of value. used for comparison
    this.json = JSON.stringify(this.value);

    var parsedValue = this.type === 'color' ? parseColor(this.value) : value;
    this.calculate = MapboxGLFunction[reference.function || 'piecewise-constant'](parsedValue);
    this.isFeatureConstant = this.calculate.isFeatureConstant;
    this.isGlobalConstant = this.calculate.isGlobalConstant;

    if (reference.function === 'piecewise-constant' && reference.transition) {
        this.calculate = transitioned(this.calculate);
    }
}

function transitioned(calculate) {
    return function(globalProperties, featureProperties) {
        var z = globalProperties.$zoom;
        var zh = globalProperties.$zoomHistory;
        var duration = globalProperties.$duration;

        var fraction = z % 1;
        var t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        var fromScale = 1;
        var toScale = 1;
        var mix, from, to;

        if (z > zh.lastIntegerZoom) {
            mix = fraction + (1 - fraction) * t;
            fromScale *= 2;
            from = calculate({$zoom: z - 1}, featureProperties);
            to = calculate({$zoom: z}, featureProperties);
        } else {
            mix = 1 - (1 - t) * fraction;
            to = calculate({$zoom: z}, featureProperties);
            from = calculate({$zoom: z + 1}, featureProperties);
            fromScale /= 2;
        }

        return {
            from: from,
            fromScale: fromScale,
            to: to,
            toScale: toScale,
            t: mix
        };
    };
}
