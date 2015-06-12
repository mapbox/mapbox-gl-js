'use strict';

exports['interpolated'] = createScale;

exports['piecewise-constant'] = function (parameters) {

    if (!(parameters.stops) && !(parameters.range)) {
        return function() { return parameters; }
    } else {
        parameters = clone(parameters);
        parameters.rounding = 'floor';
        return createScale(parameters);
    }
}

function createScale(parameters) {

    // If the scale doesn't define a range or stops, no interpolation will
    // occur and the output value is a constant.
    if (!(parameters.stops) && !(parameters.range)) {
        return function() { return parameters; }
    }

    // START BACKWARDS COMPATIBILITY TRANSFORMATIONS

    // If parameters.stops is specified, deconstruct it into a domain and range.
    if (parameters.stops) {
        parameters.domain = [];
        parameters.range = [];

        for (var i = 0; i <parameters.stops.length; i++) {
            parameters.domain.push(parameters.stops[i][0]);
            parameters.range.push(parameters.stops[i][1]);
        }
    }

    // END BACKWARDS COMPATIBILTY TRANSFORMATIONS

    return function(attributes) {

        // START BACKWARDS COMPATIBILITY TRANSFORMATIONS

        // If attributes is not an object, assume it is a zoom value, and create an attributes
        // object out of it.
        if (typeof(attributes) !== 'object') {
            attributes = {'$zoom': attributes};
        }

        // END BACKWARDS COMPATIBILTY TRANSFORMATIONS

        assert(parameters.range.length === parameters.domain.length);

        if (parameters.property === undefined) parameters.property = '$zoom';
        if (parameters.rounding === undefined) parameters.rounding = 'normal';
        if (parameters.base === undefined) parameters.base = 1;

        assert(parameters.domain);
        assert(parameters.range);
        assert(parameters.domain.length === parameters.range.length);

        var input = attributes[parameters.property];

        // Find the first domain value larger than input
        for (var i = 0; i < parameters.domain.length && input >= parameters.domain[i]; i++);

        // Interpolate to get the output
        if (i === 0 || parameters.rounding === 'ceiling') {
            return parameters.range[i];

        } else if (i === parameters.range.length || parameters.rounding === 'floor') {
            assert(i - 1 < parameters.range.length);
            return parameters.range[i - 1];

        } else if (parameters.rounding === 'normal') {
            return interpolate(
                input,
                parameters.base,
                parameters.domain[i - 1], parameters.domain[i],
                parameters.range[i - 1], parameters.range[i]
            );

        } else {
            assert('false');
        }
    }
}

function interpolate(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    if (outputLower.length) {
        return interpolateArray.apply(this, arguments);
    } else {
        return interpolateNumber.apply(this, arguments);
    }
}

function interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    var difference =  inputUpper - inputLower;
    var progress = input - inputLower;

    var ratio;
    if (base === 1) {
        ratio = progress / difference;
    } else {
        ratio = (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }

    return (outputLower * (1 - ratio)) + (outputUpper * ratio);
}

function interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    var output = [];
    for (var i = 0; i < outputLower.length; i++) {
        output[i] = interpolateNumber(input, base, inputLower, inputUpper, outputLower[i], outputUpper[i]);
    }
    return output;
}

function clone(input) {
    if (input === null || typeof(input) !== 'object') return input;

    var output = input.constructor();

    for (var key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            output[key] = clone(input[key]);
        }
    }

    return output;
}

function assert(predicate, message) {
    if (!predicate) {
        throw new Error(message || 'Assertion failed');
    }
}
