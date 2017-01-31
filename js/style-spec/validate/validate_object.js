'use strict';

var ValidationError = require('../error/validation_error');
var getType = require('../util/get_type');
var validateSpec = require('./validate');

module.exports = function validateObject(options) {
    var key = options.key;
    var object = options.value;
    var elementSpecs = options.valueSpec || {};
    var elementValidators = options.objectElementValidators || {};
    var style = options.style;
    var styleSpec = options.styleSpec;
    var errors = [];

    var type = getType(object);
    if (type !== 'object') {
        return [new ValidationError(key, object, 'object expected, %s found', type)];
    }

    for (var objectKey in object) {
        var elementSpecKey = objectKey.split('.')[0]; // treat 'paint.*' as 'paint'
        var elementSpec = elementSpecs[elementSpecKey] || elementSpecs['*'];

        var validateElement;
        if (elementValidators[elementSpecKey]) {
            validateElement = elementValidators[elementSpecKey];
        } else if (elementSpecs[elementSpecKey]) {
            validateElement = validateSpec;
        } else if (elementValidators['*']) {
            validateElement = elementValidators['*'];
        } else if (elementSpecs['*']) {
            validateElement = validateSpec;
        } else {
            errors.push(new ValidationError(key, object[objectKey], 'unknown property "%s"', objectKey));
            continue;
        }

        errors = errors.concat(validateElement({
            key: (key ? key + '.' : key) + objectKey,
            value: object[objectKey],
            valueSpec: elementSpec,
            style: style,
            styleSpec: styleSpec,
            object: object,
            objectKey: objectKey
        }));
    }

    for (elementSpecKey in elementSpecs) {
        if (elementSpecs[elementSpecKey].required && elementSpecs[elementSpecKey]['default'] === undefined && object[elementSpecKey] === undefined) {
            errors.push(new ValidationError(key, object, 'missing required property "%s"', elementSpecKey));
        }
    }

    return errors;
};
