'use strict';

var getType = require('../get_type');
var validate = require('./validate');
var ValidationError = require('../validation_error');

module.exports = function validateArray(key, val, spec, context, validateElement) {
    if (getType(val) !== 'array') {
        return new ValidationError(key, val, 'array expected, %s found', getType(val));
    }

    if (spec.length && val.length !== spec.length) {
        return new ValidationError(key, val, 'array length %d expected, length %d found', spec.length, val.length);
    }

    if (spec['min-length'] && val.length < spec['min-length']) {
        return new ValidationError(key, val, 'array length at least %d expected, length %d found', spec['min-length'], val.length);
    }

    var value = {
        "type": spec.value
    };

    if (context.reference.$version < 7) {
        value.function = spec.function;
    }

    if (getType(spec.value) === 'object') {
        value = spec.value;
    }

    var errors = [];
    for (var i = 0; i < val.length; i++) {
        errors = errors.concat((validateElement || validate)(key + '[' + i + ']', val[i], value, context));
    }
    return errors;
};
