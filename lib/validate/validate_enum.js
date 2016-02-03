'use strict';

var ValidationError = require('../error/validation_error');
var unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateEnum(options) {
    var key = options.key;
    var value = options.value;
    var valueSpec = options.valueSpec;
    var errors = [];

    if (valueSpec.values.indexOf(unbundle(value)) === -1) {
        errors.push(new ValidationError(key, value, 'expected one of [%s], %s found', valueSpec.values.join(', '), value));
    }
    return errors;
};
