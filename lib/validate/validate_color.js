'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');
var parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = function validateColor(key, val) {
    var type = getType(val);
    if (type !== 'string') {
        return new ValidationError(key, val, 'color expected, %s found', type);
    }

    if (parseCSSColor(val) === null) {
        return new ValidationError(key, val, 'color expected, "%s" found', val);
    }

};
