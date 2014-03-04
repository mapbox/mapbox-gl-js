'use strict';

var util = require('../util/util.js');

module.exports = StyleDeclaration;

/*
 * A parsed representation of a property:value pair
 */
function StyleDeclaration(prop, value, constants) {

    var parser = this.parsers[prop];
    if (!parser) return;

    this.prop = prop;

    if (typeof constants === 'object' && value in constants) {
        value = constants[value];
    }

    this.value = parser(value);
    this.constants = constants;

    // immuatable representation of value. used for comparison
    this.json = JSON.stringify(value);

}

StyleDeclaration.prototype.calculate = function(z) {
    return typeof this.value === 'function' ? this.value(z) : this.value;
};

StyleDeclaration.prototype.parsers = {
    hidden: parseFunction,
    opacity: parseFunction,

    color: parseColor,
    stroke: parseColor,

    width: parseWidth,
    offset: parseWidth,
    radius: parseWidth,
    blur: parseWidth,
    size: parseWidth,
    rotate: parseWidth,

    dasharray: parseDasharray,
    translate: parseDasharray,

    antialias: constant,
    image: constant,
    invert: constant,
    imageSize: constant,
    alignment: constant,
    pattern: constant,

    spin: constant,
    brightness_low: constant,
    brightness_high: constant,
    saturation: constant

};

function constant(x) {
    return x;
}

function parseWidth(width) {
    width = parseFunction(width);
    var value = +width;
    return !isNaN(value) ? value : width;
}

function parseDasharray(array) {
    return array.map(parseWidth);
}

var colorCache = {};

function parseColor(value) {
    if (Array.isArray(value)) {
        return util.premultiply(value.slice());
    }

    if (colorCache[value]) {
        return colorCache[value];
    }

    var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');

    canvas.width = 1;
    canvas.height = 1;

    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    var c = ctx.getImageData(0, 0, 1, 1).data;

    var color = util.premultiply([c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255]);
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
    if (Array.isArray(fn)) {
        if (!functionParsers[fn[0]]) {
            throw new Error('The function "' + fn[0] + '" does not exist');
        }
        return functionParsers[fn[0]].apply(null, fn.slice(1));
    } else {
        return fn;
    }
}

/*
 * Function parsers
 */

function linear(z_base, val, slope, min, max) {
    z_base = +z_base || 0;
    val = +val || 0;
    slope = +slope || 0;
    min = +min || 0;
    max = +max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + (z - z_base) * slope), max);
    };
}

function exponential(z_base, val, slope, min, max) {
    z_base = +z_base || 0;
    val = +val || 0;
    slope = +slope || 0;
    min = +min || 0;
    max = +max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + Math.pow(1.75, (z - z_base)) * slope), max);
    };
}

function min(min_z) {
    min_z = +min_z || 0;
    return function(z) {
        return z >= min_z;
    };
}

function stopsFn() {
    var stops = Array.prototype.slice.call(arguments);
    return function(z) {
        z += 1;

        var smaller = null;
        var larger = null;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop.z <= z && (!smaller || smaller.z < stop.z)) smaller = stop;
            if (stop.z >= z && (!larger || larger.z > stop.z)) larger = stop;
        }

        if (smaller && larger) {
            if (larger.z == smaller.z || larger.val == smaller.val) return smaller.val;
            var factor = (z - smaller.z) / (larger.z - smaller.z);
            // Linear interpolation if base is 0
            if (smaller.val === 0) return factor * larger.val;
            // Exponential interpolation between the values
            return smaller.val * Math.pow(larger.val / smaller.val, factor);
        } else if (larger || smaller) {
            // Do not draw a line.
            return null;

            // Exponential extrapolation of the smaller or larger value
            //var edge = larger || smaller;
            //return Math.pow(2, z) * (edge.val / Math.pow(2, edge.z));
        } else {
            // No stop defined.
            return 1;
        }
    };
}
