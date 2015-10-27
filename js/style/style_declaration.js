'use strict';

var parseCSSColor = require('csscolorparser').parseCSSColor;
var MapboxGLFunction = require('mapbox-gl-function');
var util = require('../util/util');

module.exports = StyleDeclaration;

function StyleDeclaration(reference, value) {
    this.type = reference.type;
    this.transitionable = reference.transition;

    if (value == null) {
        value = reference.default;
    }

    // immutable representation of value. used for comparison
    this.json = JSON.stringify(value);

    if (this.type === 'color') {
        this.value = parseColor(value);
    } else {
        this.value = value;
    }

    if (reference.function === 'interpolated') {
        this.calculate = MapboxGLFunction.interpolated(this.value);
    } else {
        this.calculate = MapboxGLFunction['piecewise-constant'](this.value);
        if (reference.transition) {
            this.calculate = transitioned(this.calculate);
        }
    }
}

function transitioned(calculate) {
    return function(z, zh, duration) {
        var fraction = z % 1;
        var t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        var fromScale = 1;
        var toScale = 1;
        var mix, from, to;

        if (z > zh.lastIntegerZoom) {
            mix = fraction + (1 - fraction) * t;
            fromScale *= 2;
            from = calculate(z - 1);
            to = calculate(z);
        } else {
            mix = 1 - (1 - t) * fraction;
            to = calculate(z);
            from = calculate(z + 1);
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

var colorCache = {};

function parseColor(input) {

    if (colorCache[input]) {
        return colorCache[input];

    // RGBA array
    } else if (Array.isArray(input)) {
        return input;

    // GL function
    } else if (input && input.stops) {
        return util.extend({}, input, {
            stops: input.stops.map(function(step) {
                return [step[0], parseColor(step[1])];
            })
        });

    // Color string
    } else if (typeof input === 'string') {
        var output = colorDowngrade(parseCSSColor(input));
        colorCache[input] = output;
        return output;

    } else {
        throw new Error('Invalid color ' + input);
    }

}

function colorDowngrade(color) {
    return [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 1];
}
