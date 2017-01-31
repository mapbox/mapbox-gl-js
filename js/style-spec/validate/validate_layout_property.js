'use strict';

const validateProperty = require('./validate_property');

module.exports = function validateLayoutProperty(options) {
    return validateProperty(options, 'layout');
};
