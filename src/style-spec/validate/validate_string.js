// @flow

import getType from '../util/get_type.js';
import ValidationError from '../error/validation_error.js';

import type {ValidationOptions} from './validate.js';

export default function validateString(options: $Shape<ValidationOptions>): Array<ValidationError> {
    const value = options.value;
    const key = options.key;
    const type = getType(value);

    if (type !== 'string') {
        return [new ValidationError(key, value, `string expected, ${type} found`)];
    }

    return [];
}
