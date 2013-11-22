var chroma = require('./lib/chroma.js');
var util = require('./util.js');

module.exports = StyleRule;

function StyleRule(name, value, constants, oldRule) {

    var parser = this.parsers[name];
    if (!parser) return;

    this.fn = parser(value, constants);
    this.constants = constants;

    this.oldRule = oldRule;
    this.startTime = (new Date()).getTime();

    if (oldRule && oldRule.endTime <= this.startTime) {
        // Old animation's transition is done
        // Delete reference to old rule to avoid an infinite chain
        delete oldRule.oldRule;
    }
}

StyleRule.prototype.getAppliedValue = function(z, transition, time) {
    var value = this.fn;
    var appliedValue;
    if (typeof value === 'function') {
        appliedValue = value(z, this.constants);
    } else if (typeof value === 'string' && value in this.constants) {
        appliedValue = this.constants[value];
    } else {
        appliedValue = value;
    }

    time = time || (new Date()).getTime();

    this.endTime = this.startTime;

    if (transition && transition.duration && this.oldRule) {
        this.endTime += transition.duration + transition.delay;

        var oldAppliedValue = this.oldRule.getAppliedValue(z, time);
        var eased = transition.ease((time - this.startTime - transition.delay) / transition.duration);
        appliedValue = transition.interp(oldAppliedValue, appliedValue, eased);
    }

    return appliedValue;
};

StyleRule.prototype.parsers = {
    hidden: parseFunction,
    opacity: parseFunction,

    color: parseColor,
    stroke: parseColor,

    width: parseWidth,
    offset: parseWidth,

    dasharray: parseDasharray,

    pulsating: constant,
    antialias: constant,
    image: constant,
    invert: constant,
    imageSize: constant,
    alignment: constant

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

function parseColor(value, constants) {
    if (value in constants) {
        value = constants[value];
    }

    if (Array.isArray(value)) {
        return chroma(value, 'gl').premultiply();
    } else {
        return chroma(value).premultiply();
    }
}


var functionParsers = {
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
            // Exponential interpolation between the values
            if (larger.z == smaller.z) return smaller.val;
            return smaller.val * Math.pow(larger.val / smaller.val, (z - smaller.z) / (larger.z - smaller.z));
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
