'use strict';

const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');
const validateSpec = require('./validate');

module.exports = function validateObject(options) {
    const key = options.key;
    const object = options.value;
    const elementSpecs = options.valueSpec || {};
    const elementValidators = options.objectElementValidators || {};
    const style = options.style;
    const styleSpec = options.styleSpec;
    let errors = [];

    const type = getType(object);
    if (type !== 'object') {
        return [new ValidationError(key, object, 'object expected, %s found', type)];
    }

    for (const objectKey in object) {
        const elementSpecKey = objectKey.split('.')[0]; // treat 'paint.*' as 'paint'
        const elementSpec = elementSpecs[elementSpecKey] || elementSpecs['*'];

        let validateElement;
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
            key: (key ? `${key}.` : key) + objectKey,
            value: object[objectKey],
            valueSpec: elementSpec,
            style: style,
            styleSpec: styleSpec,
            object: object,
            objectKey: objectKey
        }));
    }

    for (const elementSpecKey in elementSpecs) {
        if (elementSpecs[elementSpecKey].required && elementSpecs[elementSpecKey]['default'] === undefined && object[elementSpecKey] === undefined) {
            errors.push(new ValidationError(key, object, 'missing required property "%s"', elementSpecKey));
        }
    }

    return errors;
};
