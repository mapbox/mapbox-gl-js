
const ValidationError = require('../error/validation_error');
const {getExpectedType} = require('../function');
const compile = require('../function/compile');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateExpression(options) {
    const expression = deepUnbundle(options.value.expression);
    const compiled = compile(expression, getExpectedType(options.valueSpec));
    if (compiled.result === 'success') return [];

    const key = `${options.key}.expression`;
    return compiled.errors.map((error) => {
        return new ValidationError(`${key}${error.key}`, options.value, error.error);
    });
};

function deepUnbundle (value) {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    }
    return unbundle(value);
}
