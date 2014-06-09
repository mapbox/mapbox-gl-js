'use strict';

var util = require('../util/util.js'),
    reference = require('mapbox-gl-style-spec'),
    parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = StyleDeclaration;

/*
 * A parsed representation of a property:value pair
 */
function StyleDeclaration(prop, value, constants) {

    var propReference = reference.style[prop];
    if (!propReference) return;

    if (typeof constants === 'object' && value in constants) {
        value = constants[value];
    }

    this.value = this.parseValue(value, propReference.type);
    this.prop = prop;
    this.type = propReference.type;
    this.constants = constants;

    // immuatable representation of value. used for comparison
    this.json = JSON.stringify(value);

}

StyleDeclaration.prototype.calculate = function(z) {
    return typeof this.value === 'function' ? this.value(z) : this.value;
};

StyleDeclaration.prototype.parseValue = function(value, type) {
    if (type === 'color') {
        return parseColor(value);
    } else if (type === 'number') {
        return parseNumber(value);
    } else if (type === 'boolean') {
        return Boolean(value);
    } else if (type === 'image') {
        return String(value);
    } else if (type === 'array') {
        return parseNumberArray(value);
    } else if (Array.isArray(type)) {
        return type.indexOf(value) >= 0;
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
    if (Array.isArray(value)) {
        return util.premultiply(value.slice());
    }

    if (colorCache[value]) {
        return colorCache[value];
    }
    var c = parseCSSColor(value);
    var color = util.premultiply([c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 1]);
    colorCache[value] = color;
    return color;
}


var functionParsers = StyleDeclaration.functionParsers = {
    linear: linear,
    exponential: exponential,
    min: min,
    stops: stopsFn
};

function parseFunction(fn) {
    if (fn.fn) {
        if (!functionParsers[fn.fn]) {
            throw new Error('The function "' + fn.fn + '" does not exist');
        }
        return functionParsers[fn.fn](fn);
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

function stopsFn(params) {
    var stops = params.stops;
    return function(z) {
        z += 1;

        var smaller = null;
        var larger = null;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop[0] <= z && (!smaller || smaller[0] < stop[0])) smaller = stop;
            if (stop[0] >= z && (!larger || larger[0] > stop[0])) larger = stop;
        }

        if (smaller && larger) {
            if (larger[0] == smaller[0] || larger[1] == smaller[1]) return smaller[1];
            var factor = (z - smaller[0]) / (larger[0] - smaller[0]);
            // Linear interpolation if base is 0
            if (smaller[1] === 0) return factor * larger[1];
            // Exponential interpolation between the values
            return smaller[1] * Math.pow(larger[1] / smaller[1], factor);
        } else if (larger || smaller) {
            // use the closest stop for z beyond the stops range
            return smaller ? smaller[1] : larger[1];

            // Exponential extrapolation of the smaller or larger value
            //var edge = larger || smaller;
            //return Math.pow(2, z) * (edge.val / Math.pow(2, edge.z));
        } else {
            // No stop defined.
            return 1;
        }
    };
}
