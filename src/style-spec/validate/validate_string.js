
const getType = require('../util/get_type');
const ValidationError = require('../error/validation_error');

module.exports = function validateString(options) {
    const value = options.value;
    const key = options.key;
    const type = getType(value);

    if (type !== 'string') {
        return [new ValidationError(key, value, 'string expected, %s found', type)];
    }

    return [];
};
