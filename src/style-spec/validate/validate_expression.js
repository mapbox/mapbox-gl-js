
const ValidationError = require('../error/validation_error');
const {createExpression} = require('../expression');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateExpression(options) {
    const expression = createExpression(unbundle.deep(options.value), options.valueSpec, options.expressionContext);
    if (expression.result === 'success') {
        return [];
    }

    return expression.errors.map((error) => {
        return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
    });
};
