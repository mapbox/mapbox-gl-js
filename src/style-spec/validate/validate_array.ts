import {getType, isObject} from '../util/get_type';
import validate from './validate';
import ValidationError from '../error/validation_error';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type ArraySpec = {
    value?: unknown;
    values?: unknown[];
    length?: number;
    minimum?: number;
    maximum?: number;
    function?: unknown;
};

type ArrayElementSpec<T = unknown> = {
    type: string;
    values: T[];
    minimum: number;
    maximum: number;
    function: unknown;
};

type ArrayValidatorOptions<T = unknown> = {
    key: string;
    value: T;
    valueSpec: ArraySpec;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    arrayElementValidator: (...args: unknown[]) => ValidationError[];
};

export default function validateArray(options: ArrayValidatorOptions): ValidationError[] {
    const array = options.value;
    const arraySpec = options.valueSpec;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const key = options.key;
    const validateArrayElement = options.arrayElementValidator || validate;

    if (!Array.isArray(array)) {
        return [new ValidationError(key, array, `array expected, ${getType(array)} found`)];
    }

    if (arraySpec.length && array.length !== arraySpec.length) {
        return [new ValidationError(key, array, `array length ${arraySpec.length} expected, length ${array.length} found`)];
    }

    if (arraySpec['min-length'] && array.length < arraySpec['min-length']) {
        return [new ValidationError(key, array, `array length at least ${arraySpec['min-length']} expected, length ${array.length} found`)];
    }

    let arrayElementSpec: ArrayElementSpec = {
        type: arraySpec.value as string,
        values: arraySpec.values,
        minimum: arraySpec.minimum,
        maximum: arraySpec.maximum,
        function: undefined
    };

    if (styleSpec.$version < 7) {
        arrayElementSpec.function = arraySpec.function;
    }

    if (isObject(arraySpec.value)) {
        arrayElementSpec = arraySpec.value as ArrayElementSpec;
    }

    let errors: ValidationError[] = [];
    for (let i = 0; i < array.length; i++) {
        errors = errors.concat(validateArrayElement({
            array,
            arrayIndex: i,
            value: array[i],
            valueSpec: arrayElementSpec,
            style,
            styleSpec,
            key: `${key}[${i}]`
        }, true));
    }

    return errors;
}
