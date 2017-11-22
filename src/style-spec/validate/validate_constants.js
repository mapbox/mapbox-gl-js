
const ValidationError = require('../error/validation_error');

module.exports = function validateConstants(options) {
    const key = options.key;
    const constants = options.value;

    if (constants) {
        return [new ValidationError(key, constants, 'constants have been deprecated as of v8')];
    } else {
        return [];
    }
};
