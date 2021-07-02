// @flow
import validateExpression from './validate_expression.js';
import validateString from './validate_string.js';

export default function validateFormatted(options: any) {
    if (validateString(options).length === 0) {
        return [];
    }

    return validateExpression(options);
}
