'use strict';

module.exports = create;
module.exports.migrate = migrate;

function migrate(parameters) {
    parameters = clone(parameters);
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

function create(parameters) {

    // If the scale doesn't define a range, no interpolation will occur and the output value will be
    // constant.
    if (!parameters.range) {
        assert(parameters.rounding === undefined);
        return function() { return parameters; };
    }

    var parametersProperty = parameters.property !== undefined ? parameters.property : '$zoom';
    var parametersRounding = parameters.rounding !== undefined ? parameters.rounding : 'none';
    var parametersBase     = parameters.base     !== undefined ? parameters.base     : 1;

    assert(parameters.domain);
    assert(parameters.range);
    assert(parameters.domain.length === parameters.range.length);

    return function(attributes) {

        var input = attributes[parametersProperty];

        if (input === undefined) return parameters.range[0];

        // Find the first domain value larger than input
        var i = 0;
        while (true) {
            if (i >= parameters.domain.length) break;
            else if (input < parameters.domain[i]) break;
            else i++;
        }

        if (i === 0) {
            return parameters.range[i];

        } else if (i === parameters.range.length || parametersRounding === 'floor') {
            return parameters.range[i - 1];

        } else {
            assert(parametersRounding === 'none');
            return interpolate(
                input,
                parametersBase,
                parameters.domain[i - 1],
                parameters.domain[i],
                parameters.range[i - 1],
                parameters.range[i]
            );
        }
    };
}

function interpolate(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    if (outputLower.length) {
        return interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper);
    } else {
        return interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper);
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

function assert(predicate, message) {
    if (!predicate) {
        throw new Error(message || 'Assertion failed');
    }
}

function clone(input) {
    if (input === null || typeof input !== 'object') return input;

    var output = input.constructor();

    for (var key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            output[key] = clone(input[key]);
        }
    }

    return output;
}
