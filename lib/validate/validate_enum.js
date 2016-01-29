'use strict';

var ValidationError = require('../validation_error');
var unbundle = require('../unbundle');
var latestStyleSpec = require('../../reference/latest.min');

module.exports = function validateEnum(options) {
    var key = options.key;
    var value = options.value;
    var valueSpec = options.valueSpec || latestStyleSpec;
    var errors = [];

    if (valueSpec.values.indexOf(unbundle(value)) === -1) {
        errors.push(new ValidationError(key, value, 'expected one of [%s], %s found', valueSpec.values.join(', '), value));
    }
    return errors;
};
