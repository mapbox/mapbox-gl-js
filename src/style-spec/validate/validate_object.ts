import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import {getType, isObject} from '../util/get_type';
import validateSpec from './validate';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification, LayerSpecification} from '../types';

type ObjectElementValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

type ObjectValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec?: object;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    object?: object;
    objectKey?: string;
    layer?: LayerSpecification;
    objectElementValidators?: Record<string, (options: ObjectElementValidatorOptions) => ValidationError[]>;
};

export default function validateObject(options: ObjectValidatorOptions): ValidationError[] {
    const key = options.key;
    const object = options.value;
    const elementSpecs = options.valueSpec || {};
    const elementValidators = options.objectElementValidators || {};
    const style = options.style;
    const styleSpec = options.styleSpec;

    if (!isObject(object)) {
        return [new ValidationError(key, object, `object expected, ${getType(object)} found`)];
    }

    let errors: ValidationError[] = [];
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
