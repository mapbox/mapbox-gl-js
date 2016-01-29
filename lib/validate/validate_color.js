'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');
var parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = function validateColor(options) {
    var key = options.key;
    var value = options.value;
    var type = getType(value);

    if (type !== 'string') {
        return new ValidationError(key, value, 'color expected, %s found', type);
    }

    if (parseCSSColor(value) === null) {
        return new ValidationError(key, value, 'color expected, "%s" found', value);
    }

};
