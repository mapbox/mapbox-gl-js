
const ValidationError = require('../error/validation_error');
const {createExpression} = require('../expression');
const {getExpectedType, getDefaultValue} = require('../expression');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateExpression(options) {
    const expression = createExpression(
        deepUnbundle(options.value.expression),
        {
            context: options.expressionContext,
            expectedType: getExpectedType(options.valueSpec),
            defaultValue: getDefaultValue(options.valueSpec)
        });

    if (expression.result === 'success') {
        return [];
    }

    const key = `${options.key}.expression`;
    return expression.errors.map((error) => {
        return new ValidationError(`${key}${error.key}`, options.value, error.message);
    });
};

function deepUnbundle (value) {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    }
    return unbundle(value);
}
