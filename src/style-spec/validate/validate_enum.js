'use strict';

const ValidationError = require('../error/validation_error');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateEnum(options) {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;
    const errors = [];

    if (Array.isArray(valueSpec.values)) { // <=v7
        if (valueSpec.values.indexOf(unbundle(value)) === -1) {
            errors.push(new ValidationError(key, value, 'expected one of [%s], %s found', valueSpec.values.join(', '), value));
        }
    } else { // >=v8
        if (Object.keys(valueSpec.values).indexOf(unbundle(value)) === -1) {
            errors.push(new ValidationError(key, value, 'expected one of [%s], %s found', Object.keys(valueSpec.values).join(', '), value));
        }
    }
    return errors;
};
