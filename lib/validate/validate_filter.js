'use strict';

var ValidationError = require('../validation_error');
var validateEnum = require('./validate_enum');
var getType = require('../get_type');
var unbundle = require('../unbundle');

module.exports = function validateFilter(key, val, _, context) {
    var type;
    var errors = [];

    if (getType(val) !== 'array') {
        return new ValidationError(key, val, 'array expected, %s found', getType(val));
    }

    if (val.length < 1) {
        return new ValidationError(key, val, 'filter array must have at least 1 element');
    }

    errors = errors.concat(validateEnum(key + '[0]', val[0], context.reference.filter_operator));

    switch (unbundle(val[0])) {
        case '<':
        case '<=':
        case '>':
        case '>=':
            if (val.length >= 2 && val[1] == '$type') {
                errors.push(new ValidationError(key, val, '"$type" cannot be use with operator "%s"', val[0]));
            }
        /* falls through */
        case '==':
        case '!=':
            if (val.length != 3) {
                errors.push(new ValidationError(key, val, 'filter array for operator "%s" must have 3 elements', val[0]));
            }
        /* falls through */
        case 'in':
        case '!in':
            if (val.length >= 2) {
                type = getType(val[1]);
                if (type !== 'string') {
                    errors.push(new ValidationError(key + '[1]', val[1], 'string expected, %s found', type));
                } else if (val[1][0] === '@') {
                    errors.push(new ValidationError(key + '[1]', val[1], 'filter key cannot be a constant'));
                }
            }
            for (var i = 2; i < val.length; i++) {
                type = getType(val[i]);
                if (val[1] == '$type') {
                    errors = errors.concat(validateEnum(key + '[' + i + ']', val[i], context.reference.geometry_type));
                } else if (type === 'string' && val[i][0] === '@') {
                    errors.push(new ValidationError(key + '[' + i + ']', val[i], 'filter value cannot be a constant'));
                } else if (type !== 'string' && type !== 'number' && type !== 'boolean') {
                    errors.push(new ValidationError(key + '[' + i + ']', val[i], 'string, number, or boolean expected, %s found', type));
                }
            }
            break;

        case 'any':
        case 'all':
        case 'none':
            for (i = 1; i < val.length; i++) {
                errors = errors.concat(validateFilter(key + '[' + i + ']', val[i]));
            }
            break;
    }

    return errors;
};
