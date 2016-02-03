'use strict';

var ValidationError = require('../error/validation_error');
var getType = require('../util/get_type');
var validate = require('./validate');
var latestStyleSpec = require('../../reference/latest.min');

module.exports = function validateObject(options) {
    // TODO rename subkey and value to objectKey and object
    var key = options.key;
    var value = options.value;
    var valueSpec = options.valueSpec;
    var objectElementValidators = options.objectElementValidators || {};
    var objectElementValidator = options.objectElementValidator;
    var style = options.style;
    var styleSpec = options.styleSpec || latestStyleSpec;
    var errors = [];

    var type = getType(value);
    if (type !== 'object') {
        return new ValidationError(key, value, 'object expected, %s found', type);
    }

    // TODO rename subkey and value to objectKey and object
    for (var subkey in value) {
        // TODO remove layer-specific logic
        var valueSpecKey = subkey.split('.')[0]; // treat 'paint.*' as 'paint'
        var objectElementSpec = valueSpec && (valueSpec[valueSpecKey] || valueSpec['*']);

        if (objectElementSpec || objectElementValidator) {
            // TODO get objectElementValidator from objectElementValidators['*']
            var validateElement = objectElementValidator || objectElementValidators[valueSpecKey] || validate;
            errors = errors.concat(validateElement({
                layer: options.layer, // TODO remove this? use extend?
                key: (key ? key + '.' : key) + subkey,
                value: value[subkey],
                valueSpec: objectElementSpec,
                style: style,
                styleSpec: styleSpec,
                object: value,
                objectKey: subkey
            }));

        // tolerate root-level extra keys & arbitrary layer properties
        // TODO remove this layer-specific logic
        } else if (key !== '' && key.split('.').length !== 1) {
            errors.push(new ValidationError(key, value[subkey], 'unknown property "%s"', subkey));
        }
    }

    for (valueSpecKey in valueSpec) {
        if (valueSpec[valueSpecKey].required && valueSpec[valueSpecKey]['default'] === undefined && value[valueSpecKey] === undefined) {
            errors.push(new ValidationError(key, value, 'missing required property "%s"', valueSpecKey));
        }
    }

    return errors;
};
