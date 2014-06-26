'use strict';

var util = require('../util/util.js'),
    reference = require('mapbox-gl-style-spec').v3,
    parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = StyleDeclaration;

/*
 * A parsed representation of a property:value pair
 */
function StyleDeclaration(renderType, prop, value, constants) {
    var className = 'class_' + renderType;
    var propReference = reference[className] && reference[className][prop];
    if (!propReference) return;

    if (typeof constants === 'object' && value in constants) {
        value = constants[value];
    }

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
    num = parseFunction(num);
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
    if (value.fn === 'stops') {
        for (var i = 0; i < value.stops.length; i++) {
            // store the parsed color as the 3rd element in the array
            value.stops[i][2] = parseCSSColor(value.stops[i][1]);
        }
        return parseFunction(value, true);
    }

    if (Array.isArray(value)) {
        return util.premultiply(value.slice());
    }

    if (colorCache[value]) {
        return colorCache[value];
    }
    var color = prepareColor(parseCSSColor(value));
    colorCache[value] = color;
    return color;
}


var functionParsers = StyleDeclaration.functionParsers = {
    linear: linear,
    exponential: exponential,
    min: min,
    stops: stopsFn
};

function parseFunction(fn, color) {
    if (fn.fn) {
        if (!functionParsers[fn.fn]) {
            throw new Error('The function "' + fn.fn + '" does not exist');
        }
        return functionParsers[fn.fn](fn, color);
    } else {
        return fn;
    }
}

/*
 * Function parsers
 */

function linear(params) {
    var z_base = +params.z || 0,
        val = +params.val || 0,
        slope = +params.slope || 0,
        min = +params.min || 0,
        max = +params.max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + (z - z_base) * slope), max);
    };
}

function exponential(params) {
    var z_base = +params.z || 0,
        val = +params.val || 0,
        slope = +params.slope || 0,
        min = +params.min || 0,
        max = +params.max || Infinity,
        base = +params.base || 1.75;
    return function(z) {
        return Math.min(Math.max(min, val + Math.pow(base, (z - z_base)) * slope), max);
    };
}

function min(params) {
    var min_z = +params.min || 0;
    return function(z) {
        return z >= min_z;
    };
}

function stopsFn(params, color) {
    var stops = params.stops;
    return function(z) {
        z += 1;

        var low = null;
        var high = null;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop[0] <= z && (!low || low[0] < stop[0])) low = stop;
            if (stop[0] >= z && (!high || high[0] > stop[0])) high = stop;
        }

        if (low && high) {
            if (high[0] == low[0] || high[1] == low[1]) {
                if (color) return prepareColor(low[2]);
                return low[1];
            }
            var factor = (z - low[0]) / (high[0] - low[0]);

            // If color, interpolate between values
            if (color) return prepareColor(interpColor(low[2], high[2], factor));
            // Linear interpolation if base is 0
            if (low[1] === 0) return factor * high[1];
            // Exponential interpolation between the values
            return low[1] * Math.pow(high[1] / low[1], factor);
        } else if (high || low) {
            // use the closest stop for z beyond the stops range
            if (color) return low ? prepareColor(low[2]) : prepareColor(high[2]);
            return low ? low[1] : high[1];

            // Exponential extrapolation of the low or high value
            //var edge = high || low;
            //return Math.pow(2, z) * (edge.val / Math.pow(2, edge.z));
        } else {
            // No stop defined.
            return 1;
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
