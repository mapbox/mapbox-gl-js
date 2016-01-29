'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');

module.exports = function validateConstants(key, val, _, context) {

    if (context.reference.$version > 7) {
        if (val) {
            return new ValidationError(key, val, 'constants have been deprecated as of v8');
        }
    } else {
        var type = getType(val);
        if (type !== 'object') {
            return new ValidationError(key, val, 'object expected, %s found', type);
        }

        var errors = [];
        for (var k in val) {
            if (k[0] !== '@') {
                errors.push(new ValidationError(key + '.' + k, val[k], 'constants must start with "@"'));
            }
        }
        return errors;
    }

};
