'use strict';

var util = require('../util/util.js'),
    reference = require('mapbox-gl-style-spec/reference/v4'),
    parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = StyleDeclaration;

/*
 * A parsed representation of a property:value pair
 */
function StyleDeclaration(renderType, prop, value, constants) {
    var className = 'class_' + renderType;
    var propReference = reference[className] && reference[className][prop];
    if (!propReference) return;

    this.value = this.parseValue(value, propReference.type, propReference.values, constants);
    this.prop = prop;
    this.type = propReference.type;

    // immuatable representation of value. used for comparison
    this.json = JSON.stringify(value);

}

StyleDeclaration.prototype.calculate = function(z) {
    return typeof this.value === 'function' ? this.value(z) : this.value;
};

StyleDeclaration.prototype.parseValue = function(value, type, values, constants) {
    if (typeof constants === 'object') {
        if (value in constants) value = constants[value];
        if (value.stops) {
            for (var i = 0; i < value.stops.length; i++) {
                if (value.stops[i][1] in constants) value.stops[i][1] = constants[value.stops[i][1]];
            }
        }
    }
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
    if (value.stops) {
        for (var i = 0; i < value.stops.length; i++) {
            // store the parsed color as the 3rd element in the array
            value.stops[i][2] = parseCSSColor(value.stops[i][1]);
        }
        return stopsFn(value, true);
    }

    if (colorCache[value]) {
        return colorCache[value];
    }
    var color = prepareColor(parseCSSColor(value));
    colorCache[value] = color;
    return color;
}

function stopsFn(params, color) {
    var stops = params.stops;
    var base = params.base || (color ? 1 : 1.75);

    return function(z) {

        // find the two stops which the current z is between
        var low = null;
        var high = null;
        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop[0] <= z) low = stop;
            if (stop[0] > z) {
                high = stop;
                break;
            }
        }

        if (low && high) {
            var zoomDiff = high[0] - low[0];
            var zoomProgress = z - low[0];
            var t = 0;
            if (base == 1) {
                t = zoomProgress / zoomDiff;
            } else {
                t = (Math.pow(base, zoomProgress) - 1) / (Math.pow(base, zoomDiff) - 1);
            }
            if (color) return prepareColor(interpColor(low[2], high[2], t));
            else return util.interp(low[1], high[1], t);

        } else if (low) {
            if (color) return prepareColor(low[2]);
            else return low[1];

        } else if (high) {
            if (color) return prepareColor(high[2]);
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
