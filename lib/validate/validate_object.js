'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');
var validate = require('./validate');
var latestStyleSpec = require('../../reference/latest.min');

module.exports = function validateObject(options) {
    var key = options.key;
    var value = options.value;
    var valueSpec = options.valueSpec;
    var validators = options.objectElementValidators || {};
    var style = options.style;
    var styleSpec = options.styleSpec || latestStyleSpec;
    var errors = [];

    var type = getType(value);
    if (type !== 'object') {
        return new ValidationError(key, value, 'object expected, %s found', type);
    }

    for (var subkey in value) {
        var valueSpecKey = subkey.split('.')[0]; // treat 'paint.*' as 'paint'
        var objectElementSpec = valueSpec[valueSpecKey] || valueSpec['*'];
        var transitionMatch = valueSpecKey.match(/^(.*)-transition$/);

        if (objectElementSpec) {
            var objectElementValidator = validators[valueSpecKey] || validate;
            errors = errors.concat(objectElementValidator({
                key: (key ? key + '.' : key) + subkey,
                value: value[subkey],
                valueSpec: objectElementSpec,
                style: style,
                styleSpec: styleSpec
            }));

        } else if (transitionMatch && valueSpec[transitionMatch[1]] && valueSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key: (key ? key + '.' : key) + subkey,
                value: value[subkey],
                valueSpec: styleSpec.transition,
                style: style,
                styleSpec: styleSpec
            }));

        // tolerate root-level extra keys & arbitrary layer properties
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
