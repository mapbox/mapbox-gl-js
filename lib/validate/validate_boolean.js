'use strict';

var getType = require('../get_type');
var ValidationError = require('../validation_error');

module.exports = function validateBoolean(key, val) {
    var type = getType(val);
    if (type !== 'boolean') {
        return new ValidationError(key, val, 'boolean expected, %s found', 'string', type);
    }
};
