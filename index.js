'use strict';

module.exports = create;
module.exports.migrate = migrate;
module.exports.validate = validate;
module.exports.is = isScale;

function isScale(value) {
    return isObject(value);
}

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

function validate(parameters) {
    if (!isScale(parameters)) return;

    assert(parameters.type, 'Scale must have a type of "power" or "ordinal"');
    assert(!parameters.property || isString(parameters.property), 'Scale property parameter must be null or a string');
    assert(parameters.domain, 'Scale must have a domain');
    assert(parameters.range, 'Scale must have a range');
    assert(parameters.domain.length === parameters.range.length, "Scale's domain must have the same number of domain elements as range elements");
    assert(parameters.domain.length > 0, 'Scale must have more than 0 domain elements');

    if (parameters.type === 'power') {
        assert(!parameters.rounding || parameters.rounding === 'none'  || parameters.rounding === 'floor', 'Scale rounding parameter must be one of "none", or "floor"');
        assert(!parameters.base || isNumeric(parameters.base), 'Scale base parameter must be null or a number');
    }
}

function create(parameters) {
    validate(parameters);

    // If the scale doesn't define a range, no interpolation will occur and the output value will be
    // constant.
    if (!isObject(parameters)) {
        return function() { return function() { return parameters; }; };
    }

    var property = parameters.property !== undefined ? parameters.property : '$zoom';

    return function(attributes) {
        var attribute = attributes[property];
        if (attribute === undefined) {
            return function(attributes) {
                var attribute = attributes[property];
                if (attribute === undefined) {
                    return parameters.range[0];
                } else {
                    return evaluate(parameters, attribute);
                }
            };

        } else {
            return function() {
                return evaluate(parameters, attribute);
            };
        }
    };
}

function evaluateOrdinal(parameters, attribute) {
    for (var i = 0; i < parameters.domain.length; i++) {
        if (attribute === parameters.domain[i]) {
            return parameters.range[i];
        }
    }
    return parameters.range[0];
}

function evaluatePower(parameters, attribute) {
    assert(isNumeric(parameters.domain[0]));

    var base = parameters.base !== undefined ? parameters.base : 1;
    var rounding = parameters.rounding || 'normal';

    var i = 0;
    while (true) {
        if (i >= parameters.domain.length) break;
        else if (attribute < parameters.domain[i]) break;
        else i++;
    }

    if (i === 0) {
        return parameters.range[i];

    } else if (
            i === parameters.range.length ||
            rounding === 'floor' ||
            !isInterpolatable(parameters.range[i - 1])) {
        return parameters.range[i - 1];

    } else {
        assert(rounding === 'normal');
        return interpolate(
            attribute,
            base,
            parameters.domain[i - 1],
            parameters.domain[i],
            parameters.range[i - 1],
            parameters.range[i]
        );
    }
}

function evaluate(parameters, attribute) {
    if (parameters.type === 'power') {
        return evaluatePower(parameters, attribute);
    } else if (parameters.type === 'ordinal') {
        return evaluateOrdinal(parameters, attribute);
    } else {
        assert(false);
    }
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

function isInterpolatable(value) {
    return isNumeric(value) || (Array.isArray(value) && isNumeric(value[0]));
}

function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

function isObject(value) {
    return typeof value === 'object' && !Array.isArray(value);
}

function isString(value) {
    return typeof value === 'string';
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
