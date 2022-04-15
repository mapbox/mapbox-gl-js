// @flow

import ValidationError from '../error/validation_error.js';
import getType from '../util/get_type.js';
import {parseCSSColor} from 'csscolorparser';

import type {ValidationOptions} from './validate.js';

export default function validateColor(options: ValidationOptions): Array<ValidationError> {
    const key = options.key;
    const value = options.value;
    const type = getType(value);

    if (type !== 'string') {
        return [new ValidationError(key, value, `color expected, ${type} found`)];
    }

    if (parseCSSColor(value) === null) {
        return [new ValidationError(key, value, `color expected, "${value}" found`)];
    }

    return [];
}
