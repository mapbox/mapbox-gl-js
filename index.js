'use strict';

var GLOBAL_ATTRIBUTE_PREFIX = '$';

module.exports = create;
module.exports.is = is;

function create(parameters) {
    var property = parameters.property !== undefined ? parameters.property : '$zoom';

    var inner, outer;
    if (!is(parameters)) {
        inner = function() { return parameters; };
        outer = function() { return inner; };
        inner.isConstant = outer.isConstant = true;

    } else if (property[0] === GLOBAL_ATTRIBUTE_PREFIX) {
        outer = function(attributes) {
            var value = evaluate(parameters, attributes[property]);
            inner = function() { return value; };
            inner.isConstant = true;
            return inner;
        };

    } else {
        outer = function() { return inner; };
        inner = function(attributes) { return evaluate(parameters, attributes[property]); };
    }

    return outer;
}

function evaluate(parameters, attribute) {
    if (attribute === undefined) {
        return parameters.range[0];
    } else if (parameters.type === 'power') {
        return evaluatePower(parameters, attribute);
    } else if (parameters.type === 'ordinal') {
        return evaluateOrdinal(parameters, attribute);
    } else {
        assert(false);
    }
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

function is(value) {
    return typeof value === 'object' && !Array.isArray(value);
}

function isInterpolatable(value) {
    return isNumeric(value) || (Array.isArray(value) && isNumeric(value[0]));
}

function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

function assert(predicate, message) {
    if (!predicate) {
        throw new Error(message || 'Assertion failed');
    }
}
