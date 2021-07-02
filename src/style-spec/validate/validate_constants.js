
import ValidationError from '../error/validation_error.js';

export default function validateConstants(options) {
    const key = options.key;
    const constants = options.value;

    if (constants) {
        return [new ValidationError(key, constants, 'constants have been deprecated as of v8')];
    } else {
        return [];
    }
}
