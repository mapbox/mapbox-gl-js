'use strict';

var ValidationError = require('../error/validation_error');
var getType = require('../util/get_type');
var validate = require('./validate');
var validateObject = require('./validate_object');
var validateArray = require('./validate_array');

module.exports = function validateFunction(options) {
    var originalValueSpec = options.valueSpec;

    return validateObject({
        key: options.key,
        value: options.value,
        valueSpec: options.styleSpec.function,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: { stops: validateFunctionStops }
    });

    function validateFunctionStops(options) {
        var errors = [];
        var value = options.value;

        errors = errors.concat(validateArray({
            key: options.key,
            value: value,
            valueSpec: options.valueSpec,
            style: options.style,
            styleSpec: options.styleSpec,
            arrayElementValidator: validateFunctionStop
        }));

        if (getType(value) === 'array' && value.length === 0) {
            errors.push(new ValidationError(options.key, value, 'array must have at least one stop'));
        }

        return errors;
    }

    function validateFunctionStop(options) {
        var errors = [];
        var value = options.value;
        var key = options.key;

        if (getType(value) !== 'array') {
            return new ValidationError(key, value, 'array expected, %s found', getType(value));
        }

        if (value.length !== 2) {
            return new ValidationError(key, value, 'array length %d expected, length %d found', 2, value.length);
        }

        errors = errors.concat(validate({
            key: key + '[0]',
            value: value[0],
            valueSpec: {type: 'number'},
            style: options.style,
            styleSpec: options.styleSpec
        }));

        errors = errors.concat(validate({
            key: key + '[1]',
            value: value[1],
            valueSpec: originalValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        }));

        if (getType(value[0]) === 'number') {
            if (originalValueSpec.function === 'piecewise-constant' && value[0] % 1 !== 0) {
                errors.push(new ValidationError(key + '[0]', value[0], 'zoom level for piecewise-constant functions must be an integer'));
            }

            if (options.arrayIndex !== 0) {
                if (value[0] < options.array[options.arrayIndex - 1][0]) {
                    errors.push(new ValidationError(key + '[0]', value[0], 'array stops must appear in ascending order'));
                }
            }
        }

        return errors;
    }

};
