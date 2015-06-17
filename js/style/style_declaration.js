'use strict';

var parseCSSColor = require('csscolorparser').parseCSSColor;
var mapboxGLFunction = require('mapbox-gl-function');
var util = require('../util/util');

module.exports = StyleDeclaration;

function StyleDeclaration(reference, value) {
    this.type = reference.type;
    this.transitionable = reference.transition;

    // immutable representation of value. used for comparison
    this.json = JSON.stringify(value);

    if (this.type !== 'color') {
        this.value = value;
    } else if (value.stops) {
        this.value = prepareColorFunction(value);
    } else {
        this.value = parseColor(value);
    }

    if (reference.function === 'interpolated') {
        this.calculate = migrate(this.value, true);
    } else {
        this.calculate = migrate(this.value, false);
        if (reference.transition) {
            this.calculate = transitioned(this.calculate);
        }
    }
}

// TODO remove this
function migrateParameters(parameters) {
    //parameters = clone(parameters);
    if (parameters.stops) {
        parameters.domain = [];
        parameters.range = [];

        for (var i = 0; i < parameters.stops.length; i++) {
            parameters.domain.push(parameters.stops[i][0]);
            parameters.range.push(parameters.stops[i][1]);
        }

        delete parameters.stops;
    }

    return parameters;
}

// TODO remove this
function migrate(value, interpolated) {

    var parameters;
    if (value.stops) {
        parameters = migrateParameters(value);
        parameters.type = interpolated ? "power" : "ordinal";
        parameters.property = '$zoom';
    } else {
        parameters = value;
    }

    var fn = mapboxGLFunction(parameters);

    var wrapped = function(z) {
        return fn({ '$zoom': z });
    };

    wrapped.isFeatureConstant = fn.isFeatureConstant;
    return wrapped;
}

function transitioned(calculate) {
    var fakeZoomHistory = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };

    return function(z, zh, duration) {
        if (zh === undefined) zh = fakeZoomHistory;
        var fraction = z % 1;
        var t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        var fromScale = 1;
        var toScale = 1;
        var mix, from, to;

        if (z > zh.lastIntegerZoom) {
            mix = fraction + (1 - fraction) * t;
            fromScale *= 2;
            from = calculate(z - 1)({});
            to = calculate(z)({});
        } else {
            mix = 1 - (1 - t) * fraction;
            to = calculate(z)({});
            from = calculate(z + 1)({});
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

var colorCache = {};

function parseColor(value) {
    if (colorCache[value]) return colorCache[value];
    var color = prepareColor(parseCSSColor(value));
    colorCache[value] = color;
    return color;
}

function prepareColor(c) {
    return [c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 1];
}

function prepareColorFunction(f) {
    return util.extend({}, f, {stops: f.stops.map(function(stop) {
        return [stop[0], parseColor(stop[1])];
    })});
}
