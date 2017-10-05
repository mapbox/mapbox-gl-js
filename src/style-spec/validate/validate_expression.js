
const ValidationError = require('../error/validation_error');
const {createExpression} = require('../expression');
const {getExpectedType, getDefaultValue} = require('../expression');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateExpression(options) {
    const defaultValue = options.key.endsWith('heatmap-color') ? [0, 0, 0, 0] :
        getDefaultValue(options.valueSpec);
    const expression = createExpression(
        unbundle.deep(options.value), {
            context: options.expressionContext,
            expectedType: getExpectedType(options.valueSpec),
            defaultValue
        });

    if (expression.result === 'success') {
        return [];
    }

    const key = `${options.key}.expression`;
    return expression.errors.map((error) => {
        return new ValidationError(`${key}${error.key}`, options.value, error.message);
    });
};
