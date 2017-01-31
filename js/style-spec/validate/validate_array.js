'use strict';

var getType = require('../util/get_type');
var validate = require('./validate');
var ValidationError = require('../error/validation_error');

module.exports = function validateArray(options) {
    var array = options.value;
    var arraySpec = options.valueSpec;
    var style = options.style;
    var styleSpec = options.styleSpec;
    var key = options.key;
    var validateArrayElement = options.arrayElementValidator || validate;

    if (getType(array) !== 'array') {
        return [new ValidationError(key, array, 'array expected, %s found', getType(array))];
    }

    if (arraySpec.length && array.length !== arraySpec.length) {
        return [new ValidationError(key, array, 'array length %d expected, length %d found', arraySpec.length, array.length)];
    }

    if (arraySpec['min-length'] && array.length < arraySpec['min-length']) {
        return [new ValidationError(key, array, 'array length at least %d expected, length %d found', arraySpec['min-length'], array.length)];
    }

    var arrayElementSpec = {
        "type": arraySpec.value
    };

    if (styleSpec.$version < 7) {
        arrayElementSpec.function = arraySpec.function;
    }

    if (getType(arraySpec.value) === 'object') {
        arrayElementSpec = arraySpec.value;
    }

    var errors = [];
    for (var i = 0; i < array.length; i++) {
        errors = errors.concat(validateArrayElement({
            array: array,
            arrayIndex: i,
            value: array[i],
            valueSpec: arrayElementSpec,
            style: style,
            styleSpec: styleSpec,
            key: key + '[' + i + ']'
        }));
    }
    return errors;
};
