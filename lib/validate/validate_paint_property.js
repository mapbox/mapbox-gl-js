'use strict';

var latestStyleSpec = require('../../reference/latest.min');
var validate = require('./validate');

module.exports = function validatePaintProperty(options) {
    var styleSpec = options.styleSpec || latestStyleSpec;
    var layer = options.layer;
    var valueSpec = styleSpec['paint_' + layer.type];
    if (!layer.type || !valueSpec) return [];
    return validate({
        key: options.key,
        value: options.value,
        valueSpec: valueSpec,
        style: options.style,
        styleSpec: options.styleSpec
    });
};
