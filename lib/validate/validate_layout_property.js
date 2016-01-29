'use strict';

var latestReference = require('../../reference/latest');
var validate = require('./validate');

module.exports = function validateLayoutProperty(layerType, name, value, context) {
    var reference = context.reference || latestReference;
    var spec = reference['layout_' + layerType];
    return layerType && spec && validate(name, value, spec, context);
};
