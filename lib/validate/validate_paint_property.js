'use strict';

var validate = require('./validate');
var latestStyleSpec = require('../../reference/latest.min');
var ValidationError = require('../error/validation_error');

/**
 * @param options
 * @param {string} [options.key]
 * @param options.value
 * @param [options.valueSpec]
 * @param [options.style]
 * @param [options.styleSpec]
 * @param [options.layer]
 * @param options.objectKey
 */
module.exports = function validatePaintProperty(options) {
    var key = options.key;
    var style = options.style;
    var styleSpec = options.styleSpec || latestStyleSpec;
    var value = options.value;
    var propertyKey = options.objectKey;
    var layer = options.layer;
    var layerSpec = layer && styleSpec['paint_' + layer.type];

    var transitionMatch = propertyKey.match(/^(.*)-transition$/);

    if (transitionMatch && layerSpec[transitionMatch[1]] && layerSpec[transitionMatch[1]].transition) {
        return validate({
            key: key,
            value: value,
            valueSpec: styleSpec.transition,
            style: style,
            styleSpec: styleSpec
        });

    } else if (options.valueSpec || layerSpec[propertyKey]) {
        return validate({
            key: options.key,
            value: value,
            valueSpec: options.valueSpec || layerSpec[propertyKey],
            style: style,
            styleSpec: styleSpec
        });

    } else {
        return new ValidationError(key, value, 'unknown property "%s"', propertyKey);
    }

};
