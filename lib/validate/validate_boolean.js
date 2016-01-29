'use strict';

var getType = require('../get_type');
var ValidationError = require('../validation_error');

module.exports = function validateBoolean(options) {
    var value = options.value;
    var key = options.key;
    var type = getType(value);

    if (type !== 'boolean') {
        return new ValidationError(key, value, 'boolean expected, %s found', type);
    }
};
