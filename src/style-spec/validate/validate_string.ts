import getType from '../util/get_type';
import ValidationError from '../error/validation_error';

import type {ValidationOptions} from './validate';

export default function validateString(options: Partial<ValidationOptions>): Array<ValidationError> {
    const value = options.value;
    const key = options.key;
    const type = getType(value);

    if (type !== 'string') {
        return [new ValidationError(key, value, `string expected, ${type} found`)];
    }

    return [];
}
