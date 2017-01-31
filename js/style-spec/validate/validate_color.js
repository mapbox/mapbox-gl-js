'use strict';

const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');
const parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = function validateColor(options) {
    const key = options.key;
    const value = options.value;
    const type = getType(value);

    if (type !== 'string') {
        return [new ValidationError(key, value, 'color expected, %s found', type)];
    }

    if (parseCSSColor(value) === null) {
        return [new ValidationError(key, value, 'color expected, "%s" found', value)];
    }

    return [];
};
