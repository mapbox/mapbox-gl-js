'use strict';

var getType = require('../util/get_type');
var ValidationError = require('../error/validation_error');

module.exports = function validateNumber(options) {
    var key = options.key;
    var value = options.value;
    var valueSpec = options.valueSpec;
    var type = getType(value);

    if (type !== 'number') {
        return [new ValidationError(key, value, 'number expected, %s found', type)];
    }

    if ('minimum' in valueSpec && value < valueSpec.minimum) {
        return [new ValidationError(key, value, '%s is less than the minimum value %s', value, valueSpec.minimum)];
    }

    if ('maximum' in valueSpec && value > valueSpec.maximum) {
        return [new ValidationError(key, value, '%s is greater than the maximum value %s', value, valueSpec.maximum)];
    }

    return [];
};
