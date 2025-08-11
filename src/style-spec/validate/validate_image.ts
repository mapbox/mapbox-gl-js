import validateExpression from './validate_expression';
import validateString from './validate_string';

import type ValidationError from '../error/validation_error';

type ImageValidatorOptions = {
    key: string;
    value: unknown;
};

export default function validateImage(options: ImageValidatorOptions): ValidationError[] {
    const errors = validateString(options);
    if (errors.length === 0) {
        return [];
    }

    return validateExpression(options);
}
