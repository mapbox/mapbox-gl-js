'use strict';

var latestStyleSpec = require('../../reference/latest.min');
var validate = require('./validate');

module.exports = function validateLayoutProperty(options) {
    var styleSpec = options.styleSpec || latestStyleSpec;
    var layer = options.layer;
    var valueSpec = styleSpec['layout_' + layer.type];
    if (!layer.type || !valueSpec) return [];
    return validate({
        key: options.key,
        value: options.value,
        valueSpec: valueSpec,
        style: options.style,
        styleSpec: styleSpec
    });
};
