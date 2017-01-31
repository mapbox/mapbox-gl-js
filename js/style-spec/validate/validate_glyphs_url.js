'use strict';

const ValidationError = require('../error/validation_error');
const validateString = require('./validate_string');

module.exports = function(options) {
    const value = options.value;
    const key = options.key;

    const errors = validateString(options);
    if (errors.length) return errors;

    if (value.indexOf('{fontstack}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{fontstack}" token'));
    }

    if (value.indexOf('{range}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{range}" token'));
    }

    return errors;
};
