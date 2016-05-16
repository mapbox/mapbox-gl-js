'use strict';

var ValidationError = require('../error/validation_error');
var getType = require('../util/get_type');
var validate = require('./validate');
var validateObject = require('./validate_object');
var validateArray = require('./validate_array');
var validateNumber = require('./validate_number');

module.exports = function validateFunction(options) {
    var functionValueSpec = options.valueSpec;
    var stopKeyType;

    var isPropertyFunction = options.value.property !== undefined || stopKeyType === 'object';
    var isZoomFunction = options.value.property === undefined || stopKeyType === 'object';

    var errors = validateObject({
        key: options.key,
        value: options.value,
        valueSpec: options.styleSpec.function,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: { stops: validateFunctionStops }
    });

    if (options.styleSpec.$version >= 8) {
       if (isPropertyFunction && !options.valueSpec['property-function']) {
           errors.push(new ValidationError(options.key, options.value, 'property functions not supported'));
       } else if (isZoomFunction && !options.valueSpec['zoom-function']) {
           errors.push(new ValidationError(options.key, options.value, 'zoom functions not supported'));
       }
    }

    return errors;

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
            return [new ValidationError(key, value, 'array expected, %s found', getType(value))];
        }

        if (value.length !== 2) {
            return [new ValidationError(key, value, 'array length %d expected, length %d found', 2, value.length)];
        }

        var type = getType(value[0]);
        if (!stopKeyType) stopKeyType = type;
        if (type !== stopKeyType) {
            return [new ValidationError(key, value, '%s stop key type must match previous stop key type %s', type, stopKeyType)];
        }

        if (type === 'object') {
            if (value[0].zoom === undefined) {
                return [new ValidationError(key, value, 'object stop key must have zoom')];
            }
            if (value[0].value === undefined) {
                return [new ValidationError(key, value, 'object stop key must have value')];
            }
            errors = errors.concat(validateObject({
                key: key + '[0]',
                value: value[0],
                valueSpec: { zoom: {} },
                style: options.style,
                styleSpec: options.styleSpec,
                objectElementValidators: { zoom: validateNumber, value: validateValue }
            }));
        } else {
            errors = errors.concat((isZoomFunction ? validateNumber : validateValue)({
                key: key + '[0]',
                value: value[0],
                valueSpec: {},
                style: options.style,
                styleSpec: options.styleSpec
            }));
        }

        errors = errors.concat(validate({
            key: key + '[1]',
            value: value[1],
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        }));

        if (getType(value[0]) === 'number') {
            if (functionValueSpec.function === 'piecewise-constant' && value[0] % 1 !== 0) {
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

    function validateValue(options) {
        var errors = [];
        var type = getType(options.value);
        if (type !== 'number' && type !== 'string' && type !== 'array') {
            errors.push(new ValidationError(options.key, options.value, 'property value must be a number, string or array'));
        }
        return errors;
    }

};
