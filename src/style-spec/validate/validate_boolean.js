
const getType = require('../util/get_type');
const ValidationError = require('../error/validation_error');

module.exports = function validateBoolean(options) {
    const value = options.value;
    const key = options.key;
    const type = getType(value);

    if (type !== 'boolean') {
        return [new ValidationError(key, value, `boolean expected, ${type} found`)];
    }

    return [];
};
