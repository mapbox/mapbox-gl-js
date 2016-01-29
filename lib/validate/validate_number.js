'use strict';

var getType = require('../get_type');
var ValidationError = require('../validation_error');

module.exports = function validateNumber(key, val, spec) {
    var type = getType(val);

    if (type !== 'number') {
        return new ValidationError(key, val, 'number expected, %s found', type);
    }

    if ('minimum' in spec && val < spec.minimum) {
        return new ValidationError(key, val, '%s is less than the minimum value %s', val, spec.minimum);
    }

    if ('maximum' in spec && val > spec.maximum) {
        return new ValidationError(key, val, '%s is greater than the maximum value %s', val, spec.maximum);
    }
};
