'use strict';

var ValidationError = require('../error/validation_error');
var validateString = require('./validate_string');

module.exports = function(options) {
    var value = options.value;
    var key = options.key;

    var errors = validateString(options);
    if (errors.length) return errors;

    if (value.indexOf('{fontstack}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{fontstack}" token'));
    }

    if (value.indexOf('{range}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{range}" token'));
    }

    return errors;
};
