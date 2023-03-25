// @flow

import ValidationError from '../error/validation_error.js';
import getType from '../util/get_type.js';

import type {ValidationOptions} from './validate.js';

export default function validateModels(options: ValidationOptions): Array<ValidationError> {
    const models = options.value;
    let errors = [];

    if (!models) {
        return errors;
    }

    const type = getType(models);
    if (type !== 'object') {
        errors = errors.concat([new ValidationError('models', models, `object expected, ${type} found`)]);
        return errors;
    }

    for (const key in models) {
        const url = models[key];
        try {
            // Allow any URL.
            new URL(url);
        } catch (e) {
            errors = errors.concat([new ValidationError('models', models, `invalid url ${url} for a modelId ${key}`)]);
            return errors;
        }
    }

    return errors;
}
