'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');
var validate = require('./validate');

module.exports = function validateObject(key, val, spec, context, validators) {
    validators = validators || {};
    var errors = [];

    var type = getType(val);
    if (type !== 'object') {
        return new ValidationError(key, val, 'object expected, %s found', type);
    }

    for (var k in val) {
        var speckey = k.split('.')[0]; // treat 'paint.*' as 'paint'
        var def = spec[speckey] || spec['*'];
        var transition = speckey.match(/^(.*)-transition$/);

        if (def) {
            errors = errors.concat((validators[speckey] || validate)((key ? key + '.' : key) + k, val[k], def, context));
        } else if (transition && spec[transition[1]] && spec[transition[1]].transition) {
            errors = errors.concat(validate((key ? key + '.' : key) + k, val[k], context.reference.transition, context));
        // tolerate root-level extra keys & arbitrary layer properties
        } else if (key !== '' && key.split('.').length !== 1) {
            errors.push(new ValidationError(key, val[k], 'unknown property "%s"', k));
        }
    }

    for (var l in spec) {
        if (spec[l].required && spec[l]['default'] === undefined && val[l] === undefined) {
            errors.push(new ValidationError(key, val, 'missing required property "%s"', l));
        }
    }

    return errors;
};
