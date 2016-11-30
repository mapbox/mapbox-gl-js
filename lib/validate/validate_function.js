'use strict';

var ValidationError = require('../error/validation_error');
var getType = require('../util/get_type');
var validate = require('./validate');
var validateObject = require('./validate_object');
var validateArray = require('./validate_array');
var validateNumber = require('./validate_number');
var unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateFunction(options) {
    var functionValueSpec = options.valueSpec;
    var functionType = unbundle(options.value.type);
    var stopKeyType;

    var isZoomFunction = options.value.property === undefined;
    var isPropertyFunction = options.value.property !== undefined;
    var isZoomAndPropertyFunction =
        getType(options.value.stops) === 'array' &&
        getType(options.value.stops[0]) === 'array' &&
        getType(options.value.stops[0][0]) === 'object';

    var errors = validateObject({
        key: options.key,
        value: options.value,
        valueSpec: options.styleSpec.function,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: { stops: validateFunctionStops }
    });

    if (functionType !== 'identity' && !options.value.stops) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "stops"'));
    }

    if (options.styleSpec.$version >= 8) {
       if (isPropertyFunction && !options.valueSpec['property-function']) {
           errors.push(new ValidationError(options.key, options.value, 'property functions not supported'));
       } else if (isZoomFunction && !options.valueSpec['zoom-function']) {
           errors.push(new ValidationError(options.key, options.value, 'zoom functions not supported'));
       }
    }

    return errors;

    function validateFunctionStops(options) {
        if (functionType === 'identity') {
            return [new ValidationError(options.key, options.value, 'identity function may not have a "stops" property')];
        }

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

        if (isZoomAndPropertyFunction) {
            if (getType(value[0]) !== 'object') {
                return [new ValidationError(key, value, 'object expected, %s found', getType(value[0]))];
            }
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
                objectElementValidators: { zoom: validateNumber, value: validateStopDomainValue }
            }));
        } else {
            errors = errors.concat((isZoomFunction ? validateNumber : validateStopDomainValue)({
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

    function validateStopDomainValue(options) {
        var type = getType(options.value);

        if (!stopKeyType) {
            stopKeyType = type;
            if (!functionType && type === 'string') {
                functionType = 'categorical';
            }
        } else if (type !== stopKeyType) {
            return [new ValidationError(options.key, options.value, '%s stop domain type must match previous stop domain type %s', type, stopKeyType)];
        }

        if (type !== 'number' && type !== 'string') {
            return [new ValidationError(options.key, options.value, 'property value must be a number or string')];
        }

        if (type !== 'number' && functionType !== 'categorical') {
            return [new ValidationError(options.key, options.value, 'number expected, %s found', type)];
        }

        return [];
    }

};
