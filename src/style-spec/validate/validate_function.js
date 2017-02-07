'use strict';

const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');
const validate = require('./validate');
const validateObject = require('./validate_object');
const validateArray = require('./validate_array');
const validateNumber = require('./validate_number');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateFunction(options) {
    const functionValueSpec = options.valueSpec;
    const functionType = unbundle(options.value.type);
    let stopKeyType;
    let stopDomainValues = {};
    let previousStopDomainValue;
    let previousStopDomainZoom;

    const isZoomFunction = functionType !== 'categorical' && options.value.property === undefined;
    const isPropertyFunction = !isZoomFunction;
    const isZoomAndPropertyFunction =
        getType(options.value.stops) === 'array' &&
        getType(options.value.stops[0]) === 'array' &&
        getType(options.value.stops[0][0]) === 'object';

    const errors = validateObject({
        key: options.key,
        value: options.value,
        valueSpec: options.styleSpec.function,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            stops: validateFunctionStops,
            default: validateFunctionDefault
        }
    });

    if (functionType === 'identity' && isZoomFunction) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "property"'));
    }

    if (functionType !== 'identity' && !options.value.stops) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "stops"'));
    }

    if (functionType === 'exponential' && options.valueSpec['function'] === 'piecewise-constant') {
        errors.push(new ValidationError(options.key, options.value, 'exponential functions not supported'));
    }

    if (options.styleSpec.$version >= 8) {
        if (isPropertyFunction && !options.valueSpec['property-function']) {
            errors.push(new ValidationError(options.key, options.value, 'property functions not supported'));
        } else if (isZoomFunction && !options.valueSpec['zoom-function']) {
            errors.push(new ValidationError(options.key, options.value, 'zoom functions not supported'));
        }
    }

    if ((functionType === 'categorical' || isZoomAndPropertyFunction) && options.value.property === undefined) {
        errors.push(new ValidationError(options.key, options.value, '"property" property is required'));
    }

    return errors;

    function validateFunctionStops(options) {
        if (functionType === 'identity') {
            return [new ValidationError(options.key, options.value, 'identity function may not have a "stops" property')];
        }

        let errors = [];
        const value = options.value;

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
        let errors = [];
        const value = options.value;
        const key = options.key;

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
            if (previousStopDomainZoom && previousStopDomainZoom > unbundle(value[0].zoom)) {
                return [new ValidationError(key, value[0].zoom, 'stop zoom values must appear in ascending order')];
            }
            if (unbundle(value[0].zoom) !== previousStopDomainZoom) {
                previousStopDomainZoom = unbundle(value[0].zoom);
                previousStopDomainValue = undefined;
                stopDomainValues = {};
            }
            errors = errors.concat(validateObject({
                key: `${key}[0]`,
                value: value[0],
                valueSpec: { zoom: {} },
                style: options.style,
                styleSpec: options.styleSpec,
                objectElementValidators: { zoom: validateNumber, value: validateStopDomainValue }
            }));
        } else {
            errors = errors.concat(validateStopDomainValue({
                key: `${key}[0]`,
                value: value[0],
                valueSpec: {},
                style: options.style,
                styleSpec: options.styleSpec
            }));
        }

        return errors.concat(validate({
            key: `${key}[1]`,
            value: value[1],
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        }));
    }

    function validateStopDomainValue(options) {
        const type = getType(options.value);
        const value = unbundle(options.value);

        if (!stopKeyType) {
            stopKeyType = type;
        } else if (type !== stopKeyType) {
            return [new ValidationError(options.key, options.value, '%s stop domain type must match previous stop domain type %s', type, stopKeyType)];
        }

        if (type !== 'number' && type !== 'string' && type !== 'boolean') {
            return [new ValidationError(options.key, options.value, 'stop domain value must be a number, string, or boolean')];
        }

        if (type !== 'number' && functionType !== 'categorical') {
            let message = 'number expected, %s found';
            if (functionValueSpec['property-function'] && functionType === undefined) {
                message += '\nIf you intended to use a categorical function, specify `"type": "categorical"`.';
            }
            return [new ValidationError(options.key, options.value, message, type)];
        }

        if (functionType === 'categorical' && type === 'number' && (!isFinite(value) || Math.floor(value) !== value)) {
            return [new ValidationError(options.key, options.value, 'integer expected, found %s', value)];
        }

        if (type === 'number' && previousStopDomainValue !== undefined && value < previousStopDomainValue) {
            return [new ValidationError(options.key, options.value, 'stop domain values must appear in ascending order')];
        } else {
            previousStopDomainValue = value;
        }

        if (functionType === 'categorical' && value in stopDomainValues) {
            return [new ValidationError(options.key, options.value, 'stop domain values must be unique')];
        } else {
            stopDomainValues[value] = true;
        }

        return [];
    }

    function validateFunctionDefault(options) {
        return validate({
            key: options.key,
            value: options.value,
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        });
    }
};
