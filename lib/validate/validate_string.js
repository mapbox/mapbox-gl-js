'use strict';

var getType = require('../get_type');
var ValidationError = require('../validation_error');

module.exports = function validateString(options) {
    var value = options.value;
    var key = options.key;
    var type = getType(value);

    if (type !== 'string') {
        return new ValidationError(key, value, 'string expected, %s found', type);
    }
};
