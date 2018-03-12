// @flow

import ValidationError from '../error/validation_error';

import { createExpression, createPropertyExpression } from '../expression';
import { deepUnbundle } from '../util/unbundle_jsonlint';

export default function validateExpression(options: any) {
    const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(deepUnbundle(options.value), options.valueSpec);
    if (expression.result === 'error') {
        return expression.value.map((error) => {
            return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
        });
    }

    if (options.expressionContext === 'property' && options.propertyKey === 'text-font' &&
        (expression.value: any)._styleExpression.expression.possibleOutputs().indexOf(undefined) !== -1) {
        return [new ValidationError(options.key, options.value, 'Invalid data expression for "text-font". Output values must be contained as literals within the expression.')];
    }

    return [];
}
