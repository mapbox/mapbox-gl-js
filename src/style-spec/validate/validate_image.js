// @flow

import validateExpression from './validate_expression.js';
import validateString from './validate_string.js';

import type {ValidationOptions} from './validate.js';
import type ValidationError from '../error/validation_error.js';

export default function validateImage(options: ValidationOptions): Array<ValidationError> {
    if (validateString(options).length === 0) {
        return [];
    }

    return validateExpression(options);
}
