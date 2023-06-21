// @flow

import ValidationError from '../error/validation_error.js';
import getType from '../util/get_type.js';

import type {ValidationOptions} from './validate.js';

export default function validateModel(options: ValidationOptions): Array<ValidationError> {
    const modelUrl = options.value;
    let errors = [];

    if (!modelUrl) {
        return errors;
    }

    const type = getType(modelUrl);
    if (type !== 'string') {
        errors = errors.concat([new ValidationError(options.key, modelUrl, `string expected, "${type}" found`)]);
        return errors;
    }

    try {
        // Allow any URL.
        new URL(modelUrl);
    } catch (e) {
        errors = errors.concat([new ValidationError(options.key, modelUrl, `invalid url "${modelUrl}"`)]);
        return errors;
    }

    return errors;
}
