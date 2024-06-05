import validateExpression from './validate_expression';
import validateString from './validate_string';

import type {ValidationOptions} from './validate';
import type ValidationError from '../error/validation_error';

export default function validateImage(options: ValidationOptions): Array<ValidationError> {
    if (validateString(options).length === 0) {
        return [];
    }

    return validateExpression(options);
}
