'use strict';

const validateProperty = require('./validate_property');

module.exports = function validatePaintProperty(options) {
    return validateProperty(options, 'paint');
};
