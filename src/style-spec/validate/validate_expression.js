// @flow

const ValidationError = require('../error/validation_error');
const {createExpression, createPropertyExpression} = require('../expression');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateExpression(options: any) {
    const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(unbundle.deep(options.value), options.valueSpec);
    if (expression.result !== 'error') {
        return [];
    }

    return expression.value.map((error) => {
        return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
    });
};
