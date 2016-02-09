'use strict';

var ValidationError = require('../error/validation_error');
var getType = require('../util/get_type');
var validate = require('./validate');

module.exports = function validateObject(options) {
    var key = options.key;
    var object = options.value;
    var valueSpec = options.valueSpec;
    var objectElementValidators = options.objectElementValidators || {};
    var style = options.style;
    var styleSpec = options.styleSpec;
    var errors = [];

    var type = getType(object);
    if (type !== 'object') {
        return [new ValidationError(key, object, 'object expected, %s found', type)];
    }

    for (var objectKey in object) {
        var valueSpecKey = objectKey.split('.')[0]; // treat 'paint.*' as 'paint'
        var objectElementSpec = valueSpec && (valueSpec[valueSpecKey] || valueSpec['*']);
        var objectElementValidator = objectElementValidators[valueSpecKey] || objectElementValidators['*'];

        if (objectElementSpec || objectElementValidator) {
            errors = errors.concat((objectElementValidator || validate)({
                key: (key ? key + '.' : key) + objectKey,
                value: object[objectKey],
                valueSpec: objectElementSpec,
                style: style,
                styleSpec: styleSpec,
                object: object,
                objectKey: objectKey
            }));

        // tolerate root-level extra keys & arbitrary layer properties
        // TODO remove this layer-specific logic
        } else if (key !== '' && key.split('.').length !== 1) {
            errors.push(new ValidationError(key, object[objectKey], 'unknown property "%s"', objectKey));
        }
    }

    for (valueSpecKey in valueSpec) {
        if (valueSpec[valueSpecKey].required && valueSpec[valueSpecKey]['default'] === undefined && object[valueSpecKey] === undefined) {
            errors.push(new ValidationError(key, object, 'missing required property "%s"', valueSpecKey));
        }
    }

    return errors;
};
