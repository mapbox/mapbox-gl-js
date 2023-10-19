// @flow

import {default as ValidationError, ValidationWarning} from '../error/validation_error.js';
import getType from '../util/get_type.js';
import validateSpec from './validate.js';

import type {ValidationOptions} from './validate.js';

type Options = ValidationOptions & {
    objectElementValidators?: Function;
};

export default function validateObject(options: Options): Array<ValidationError> {
    const key = options.key;
    const object = options.value;
    const elementSpecs = options.valueSpec || {};
    const elementValidators = options.objectElementValidators || {};
    const style = options.style;
    const styleSpec = options.styleSpec;
    let errors = [];

    const type = getType(object);
    if (type !== 'object') {
        return [new ValidationError(key, object, `object expected, ${type} found`)];
    }

    for (const objectKey in object) {
        const elementSpecKey = objectKey.split('.')[0]; // treat 'paint.*' as 'paint'
        const elementSpec = elementSpecs[elementSpecKey] || elementSpecs['*'];

        let validateElement;
        if (elementValidators[elementSpecKey]) {
            validateElement = elementValidators[elementSpecKey];
        } else if (elementSpecs[elementSpecKey]) {
            validateElement = validateSpec;
        } else if (elementValidators['*']) {
            validateElement = elementValidators['*'];
        } else if (elementSpecs['*']) {
            validateElement = validateSpec;
        }

        if (!validateElement) {
            errors.push(new ValidationWarning(key, object[objectKey], `unknown property "${objectKey}"`));
            continue;
        }

        errors = errors.concat(validateElement({
            key: (key ? `${key}.` : key) + objectKey,
            value: object[objectKey],
            valueSpec: elementSpec,
            style,
            styleSpec,
            object,
            objectKey
        // $FlowFixMe[extra-arg]
        }, object));
    }

    for (const elementSpecKey in elementSpecs) {
        // Don't check `required` when there's a custom validator for that property.
        if (elementValidators[elementSpecKey]) {
            continue;
        }

        if (elementSpecs[elementSpecKey].required && elementSpecs[elementSpecKey]['default'] === undefined && object[elementSpecKey] === undefined) {
            errors.push(new ValidationError(key, object, `missing required property "${elementSpecKey}"`));
        }
    }

    return errors;
}
