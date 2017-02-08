'use strict';

const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');

module.exports = function validateConstants(options) {
    const key = options.key;
    const constants = options.value;
    const styleSpec = options.styleSpec;

    if (styleSpec.$version > 7) {
        if (constants) {
            return [new ValidationError(key, constants, 'constants have been deprecated as of v8')];
        } else {
            return [];
        }
    } else {
        const type = getType(constants);
        if (type !== 'object') {
            return [new ValidationError(key, constants, 'object expected, %s found', type)];
        }

        const errors = [];
        for (const constantName in constants) {
            if (constantName[0] !== '@') {
                errors.push(new ValidationError(`${key}.${constantName}`, constants[constantName], 'constants must start with "@"'));
            }
        }
        return errors;
    }

};
