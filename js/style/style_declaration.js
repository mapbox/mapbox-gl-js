'use strict';

var util = require('../util/util');
var reference = require('./reference');
var parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = StyleDeclaration;

/*
 * A parsed representation of a property:value pair
 */
function StyleDeclaration(propType, renderType, prop, value, transition) {
    var className = [propType, '_', renderType].join('');
    var propReference = reference[className] && reference[className][prop];
    if (!propReference) return;

    this.transition = transition;
    this.value = this.parseValue(value, propReference);
    this.prop = prop;
    this.type = propReference.type;
    this.transitionable = propReference.transition;

    // immuatable representation of value. used for comparison
    this.json = JSON.stringify(value);

}

StyleDeclaration.prototype.calculate = function(z, zoomHistory) {
    return typeof this.value === 'function' ? this.value(z, zoomHistory) : this.value;
};

StyleDeclaration.prototype.parseValue = function(value, propReference) {
    if (!value) return value;

    if (propReference.function === 'interpolated') {
        if (value.stops) {
            return interpolatedFunction(value, propReference.type === 'color');
        } else if (propReference.type === 'color') {
            return parseColor(value);
        }
        return value;

    } else if (propReference.transition) {
        return transitionedPiecewiseConstantFunction(value.stops ? value.stops : [[0, value]], this.transition.duration);
    }

    if (value.stops) {
        return piecewiseConstantFunction(value);
    }
    return value;
};


function getBiggestStopLessThan(stops, z) {
    for (var i = 0; i < stops.length; i++) {
        if (stops[i][0] > z) {
            return stops[i === 0 ? 0 : i - 1];
        }
    }
    return stops[stops.length - 1];
}

function piecewiseConstantFunction(params) {
    return function(z) {
        return getBiggestStopLessThan(params.stops, z)[1];
    };
}

function transitionedPiecewiseConstantFunction(stops, duration) {

    return function(z, zh) {

        var fraction = z % 1;
        var t = Math.min((Date.now() - zh.lastIntegerZoomTime) / duration, 1);
        var fromScale = 1;
        var toScale = 1;
        var mix, from, to;

        if (z > zh.lastIntegerZoom) {
            mix = fraction + (1 - fraction) * t;
            fromScale *= 2;

            from = getBiggestStopLessThan(stops, z - 1);
            to = getBiggestStopLessThan(stops, z);

        } else {
            mix = 1 - (1 - t) * fraction;
            to = getBiggestStopLessThan(stops, z);
            from = getBiggestStopLessThan(stops, z + 1);
            fromScale /= 2;
        }

        return {
            from: from[1],
            fromScale: fromScale,
            to: to[1],
            toScale: toScale,
            t: mix
        };
    };
}

function interpolatedFunction(params, color) {
    var stops = params.stops;
    var base = params.base || reference.function.base.default;

    return function(z) {

        // find the two stops which the current z is between
        var low, high;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop[0] <= z) low = stop;
            if (stop[0] > z) {
                high = stop;
                break;
            }
        }

        if (low && high) {
            var zoomDiff = high[0] - low[0],
                zoomProgress = z - low[0],

                t = base === 1 ?
                    zoomProgress / zoomDiff :
                    (Math.pow(base, zoomProgress) - 1) / (Math.pow(base, zoomDiff) - 1);

            if (color) return interpColor(parseColor(low[1]), parseColor(high[1]), t);
            else if (low[1].length === 2) return interpVec2(low[1], high[1], t);
            return util.interp(low[1], high[1], t);

        } else if (low) {
            if (color) return parseColor(low[1]);
            return low[1];

        } else if (high) {
            if (color) return parseColor(high[1]);
            return high[1];

        }

        if (color) return [0, 0, 0, 1];
        return 1;
    };
}

var colorCache = {};

function parseColor(value) {
    if (colorCache[value]) return colorCache[value];

    var color = colorCache[value] = prepareColor(parseCSSColor(value));
    return color;
}

function prepareColor(c) {
    return [c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 1];
}

function interpColor(from, to, t) {
    return [
        util.interp(from[0], to[0], t),
        util.interp(from[1], to[1], t),
        util.interp(from[2], to[2], t),
        util.interp(from[3], to[3], t)
    ];
}

function interpVec2(from, to, t) {
    return [
        util.interp(from[0], to[0], t),
        util.interp(from[1], to[1], t)
    ];
}
