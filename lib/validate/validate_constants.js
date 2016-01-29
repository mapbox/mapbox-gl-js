'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');
var latestStyleSpec = require('../../reference/latest.min');

module.exports = function validateConstants(options) {
    var key = options.key;
    var constants = options.value;
    var styleSpec = options.styleSpec || latestStyleSpec;

    if (styleSpec.$version > 7) {
        if (constants) {
            return new ValidationError(key, constants, 'constants have been deprecated as of v8');
        }
    } else {
        var type = getType(constants);
        if (type !== 'object') {
            return new ValidationError(key, constants, 'object expected, %s found', type);
        }

        var errors = [];
        for (var constantName in constants) {
            if (constantName[0] !== '@') {
                errors.push(new ValidationError(key + '.' + constantName, constants[constantName], 'constants must start with "@"'));
            }
        }
        return errors;
    }

};
