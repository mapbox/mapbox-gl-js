
const ValidationError = require('../error/validation_error');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateEnum(options) {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;
    const errors = [];

    if (Array.isArray(valueSpec.values)) { // <=v7
        if (valueSpec.values.indexOf(unbundle(value)) === -1) {
            errors.push(new ValidationError(key, value, `expected one of [${valueSpec.values.join(', ')}], ${JSON.stringify(value)} found`));
        }
    } else { // >=v8
        if (Object.keys(valueSpec.values).indexOf(unbundle(value)) === -1) {
            errors.push(new ValidationError(key, value, `expected one of [${Object.keys(valueSpec.values).join(', ')}], ${JSON.stringify(value)} found`));
        }
    }
    return errors;
};
