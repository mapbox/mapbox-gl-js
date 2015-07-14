'use strict';

var MapboxGLFunction = require('mapbox-gl-function');
var parseColor = require('../util/parseColor');

module.exports = StyleDeclaration;

function StyleDeclaration(reference, value) {
    this.type = reference.type;
    this.transitionable = reference.transition;

    // immutable representation of value. used for comparison
    this.json = JSON.stringify(value);

    if (this.type === 'color') {
        this.value = parseColor(value);
    } else {
        this.value = value;
    }

    this.calculate = MapboxGLFunction(this.value);

    if (reference.function === 'discrete' && reference.transition) {
        this.calculate = transitioned(this.calculate);
    }
}

function transitioned(calculate) {
    return function(values, zh, duration) {
        var z = values.$zoom;
        var fraction = z % 1;
        var t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        var fromScale = 1;
        var toScale = 1;
        var mix, from, to;

        if (z > zh.lastIntegerZoom) {
            mix = fraction + (1 - fraction) * t;
            fromScale *= 2;

            from = calculate({$zoom: z - 1})({});
            to = calculate({$zoom: z})({});
        } else {
            mix = 1 - (1 - t) * fraction;
            to = calculate({$zoom: z})({});
            from = calculate({$zoom: z + 1})({});
            fromScale /= 2;
        }

        return function() {
            return {
                from: from,
                fromScale: fromScale,
                to: to,
                toScale: toScale,
                t: mix
            };
        };
    };
}
