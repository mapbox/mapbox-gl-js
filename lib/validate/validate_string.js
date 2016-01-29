'use strict';

var getType = require('../get_type');
var ValidationError = require('../validation_error');

module.exports = function validateString(key, val) {
    var type = getType(val);
    if (type !== 'string') {
        return new ValidationError(key, val, 'string expected, %s found', type);
    }
};
