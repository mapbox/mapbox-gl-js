import ValidationError from '../error/validation_error';
import validateString from './validate_string';

import type {ValidationOptions} from './validate';

export default function(options: ValidationOptions): Array<ValidationError> {
    const value = options.value;
    const key = options.key;

    const errors = validateString(options);
    if (errors.length) return errors;

    if (value.indexOf('{fontstack}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{fontstack}" token'));
    }

    if (value.indexOf('{range}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{range}" token'));
    }

    return errors;
}
