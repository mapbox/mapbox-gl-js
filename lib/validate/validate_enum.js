'use strict';

var ValidationError = require('../validation_error');
var unbundle = require('../unbundle');

module.exports = function validateEnum(key, val, spec) {
    var errors = [];
    if (spec.values.indexOf(unbundle(val)) === -1) {
        errors.push(new ValidationError(key, val, 'expected one of [%s], %s found', spec.values.join(', '), val));
    }
    return errors;
};
