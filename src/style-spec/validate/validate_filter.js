'use strict';

const ValidationError = require('../error/validation_error');
const validateEnum = require('./validate_enum');
const getType = require('../util/get_type');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateFilter(options) {
    const value = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    let type;

    let errors = [];

    if (getType(value) !== 'array') {
        return [new ValidationError(key, value, 'array expected, %s found', getType(value))];
    }

    if (value.length < 1) {
        return [new ValidationError(key, value, 'filter array must have at least 1 element')];
    }

    errors = errors.concat(validateEnum({
        key: `${key}[0]`,
        value: value[0],
        valueSpec: styleSpec.filter_operator,
        style: options.style,
        styleSpec: options.styleSpec
    }));

    switch (unbundle(value[0])) {
    case '<':
    case '<=':
    case '>':
    case '>=':
        if (value.length >= 2 && unbundle(value[1]) === '$type') {
            errors.push(new ValidationError(key, value, '"$type" cannot be use with operator "%s"', value[0]));
        }
        /* falls through */
    case '==':
    case '!=':
        if (value.length !== 3) {
            errors.push(new ValidationError(key, value, 'filter array for operator "%s" must have 3 elements', value[0]));
        }
        /* falls through */
    case 'in':
    case '!in':
        if (value.length >= 2) {
            type = getType(value[1]);
            if (type !== 'string') {
                errors.push(new ValidationError(`${key}[1]`, value[1], 'string expected, %s found', type));
            }
        }
        for (let i = 2; i < value.length; i++) {
            type = getType(value[i]);
            if (unbundle(value[1]) === '$type') {
                errors = errors.concat(validateEnum({
                    key: `${key}[${i}]`,
                    value: value[i],
                    valueSpec: styleSpec.geometry_type,
                    style: options.style,
                    styleSpec: options.styleSpec
                }));
            } else if (type !== 'string' && type !== 'number' && type !== 'boolean') {
                errors.push(new ValidationError(`${key}[${i}]`, value[i], 'string, number, or boolean expected, %s found', type));
            }
        }
        break;

    case 'any':
    case 'all':
    case 'none':
        for (let i = 1; i < value.length; i++) {
            errors = errors.concat(validateFilter({
                key: `${key}[${i}]`,
                value: value[i],
                style: options.style,
                styleSpec: options.styleSpec
            }));
        }
        break;

    case 'has':
    case '!has':
        type = getType(value[1]);
        if (value.length !== 2) {
            errors.push(new ValidationError(key, value, 'filter array for "%s" operator must have 2 elements', value[0]));
        } else if (type !== 'string') {
            errors.push(new ValidationError(`${key}[1]`, value[1], 'string expected, %s found', type));
        }
        break;

    }

    return errors;
};
