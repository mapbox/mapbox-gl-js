// @flow

import extend from '../util/extend.js';
import validateStyle from './validate_style.js';
import validateObject from './validate_object.js';
import ValidationError from '../error/validation_error.js';
import {unbundle} from '../util/unbundle_jsonlint.js';

import type {ValidationOptions} from './validate.js';

export default function validateImport(options: ValidationOptions): ValidationError[] {
    const {value, styleSpec} = options;
    const {data, ...importSpec} = value;

    // Preserve __line__ from the value
    Object.defineProperty(importSpec, '__line__', {
        value: value.__line__,
        enumerable: false
    });

    let errors = validateObject(extend({}, options, {
        value: importSpec,
        valueSpec: styleSpec.import
    }));

    // Empty string is reserved for the root style id
    if (unbundle(importSpec.id) === '') {
        const key = `${options.key}.id`;
        errors.push(new ValidationError(key, importSpec, `import id can't be an empty string`));
    }

    if (data) {
        const key = `${options.key}.data`;
        errors = errors.concat(validateStyle(data, styleSpec, {key}));
    }

    return errors;
}
