import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import {getType, isObject} from '../util/get_type';
import validateSpec from './validate';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification, LayerSpecification} from '../types';

type ObjectElementValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec?: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    object?: object;
    objectKey?: string;
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
        // Skip inherited keys: a hostile style JSON parsed with JSON.parse can
        // have an own "__proto__" key, but downstream consumers may have mutated
        // the prototype of `object` upstream. We never want to validate
        // inherited properties as if they were user-supplied.
        if (!Object.hasOwn(object, objectKey)) continue;

        const elementSpecKey = objectKey.split('.')[0]; // treat 'paint.*' as 'paint'
        // Object.hasOwn: a bare lookup like `elementSpecs[objectKey]` would
        // find inherited keys from Object.prototype (e.g. "__proto__",
        // "constructor", "toString") when the user-supplied key matches one,
        // returning a non-spec value that then fails as a validator.
        const hasSpec = Object.hasOwn(elementSpecs, elementSpecKey);
        const hasWildcardSpec = Object.hasOwn(elementSpecs, '*');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const elementSpec = hasSpec ? elementSpecs[elementSpecKey] : (hasWildcardSpec ? elementSpecs['*'] : undefined);

        let validateElement: ((options: ObjectElementValidatorOptions, object?: unknown) => ValidationError[]) | undefined;
        if (Object.hasOwn(elementValidators, elementSpecKey)) {
            validateElement = elementValidators[elementSpecKey];
        } else if (hasSpec) {
            validateElement = validateSpec;
        } else if (Object.hasOwn(elementValidators, '*')) {
            validateElement = elementValidators['*'];
        } else if (hasWildcardSpec) {
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
        if (!Object.hasOwn(elementSpecs, elementSpecKey)) continue;
        // Don't check `required` when there's a custom validator for that property.
        if (Object.hasOwn(elementValidators, elementSpecKey)) {
            continue;
        }

        const elementSpec = elementSpecs[elementSpecKey] as {required?: boolean; default?: unknown};
        if (elementSpec.required && elementSpec['default'] === undefined && (!Object.hasOwn(object, elementSpecKey) || object[elementSpecKey] === undefined)) {
            errors.push(new ValidationError(key, object, `missing required property "${elementSpecKey}"`));
        }
    }

    return errors;
}
