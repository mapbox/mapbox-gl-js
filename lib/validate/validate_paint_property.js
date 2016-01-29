'use strict';

var latestReference = require('../../reference/latest');
var validate = require('./validate');

module.exports = function validatePaintProperty(layerType, name, value, context) {
    var reference = context.reference || latestReference;
    var spec = reference['paint_' + layerType];
    return layerType && spec && validate(name, value, spec, context);
};
