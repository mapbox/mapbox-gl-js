'use strict';

var util = require('../util/util');
var reference = require('./reference');
var parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = StyleDeclaration;

/*
 * A parsed representation of a property:value pair
 */
function StyleDeclaration(renderType, prop, value) {
    var className = 'paint_' + renderType;
    var propReference = reference[className] && reference[className][prop];
    if (!propReference) return;

    this.value = this.parseValue(value, propReference.type, propReference.values);
    this.prop = prop;
    this.type = propReference.type;

    // immuatable representation of value. used for comparison
    this.json = JSON.stringify(value);

}

StyleDeclaration.prototype.calculate = function(z) {
    return typeof this.value === 'function' ? this.value(z) : this.value;
};

StyleDeclaration.prototype.parseValue = function(value, type, values) {
    if (type === 'color') {
        return parseColor(value);
    } else if (type === 'number') {
        return parseNumber(value);
    } else if (type === 'boolean') {
        return Boolean(value);
    } else if (type === 'image') {
        return String(value);
    } else if (type === 'string') {
        return String(value);
    } else if (type === 'array') {
        return parseNumberArray(value);
    } else if (type === 'enum' && Array.isArray(values)) {
        return values.indexOf(value) >= 0 ? value : undefined;
    } else {
        console.warn(type + ' is not a supported property type');
    }
};

function parseNumber(num) {
    if (num.stops) num = stopsFn(num);
    var value = +num;
    return !isNaN(value) ? value : num;
}

function parseNumberArray(array) {
    if (array.stops) {
        return stopsFn(array, false, true);
    }
    var widths = array.map(parseNumber);

    return function(z) {
        var result = [];
        for (var i = 0; i < widths.length; i++) {
            result.push(typeof widths[i] === 'function' ? widths[i](z) : widths[i]);
        }
        return result;
    };
}

var colorCache = {};

function parseColor(value) {
    if (value.stops) return stopsFn(value, true);
    if (colorCache[value]) return colorCache[value];

    var color = colorCache[value] = prepareColor(parseCSSColor(value));
    return color;
}

function stopsFn(params, color, dasharray) {
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
            else if (dasharray) return low[1];
            else return util.interp(low[1], high[1], t);

        } else if (low) {
            if (color) return parseColor(low[1]);
            else return low[1];

        } else if (high) {
            if (color) return parseColor(high[1]);
            else return high[1];

        } else {
            if (color) return [0, 0, 0, 1];
            else return 1;
        }
    };
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
