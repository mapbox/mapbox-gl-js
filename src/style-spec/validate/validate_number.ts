import {isNumber, getType} from '../util/get_type';
import ValidationError from '../error/validation_error';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';
import type {NumberPropertySpecification} from '../style-spec';

type NumberValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec: NumberPropertySpecification;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    arrayIndex: number;
};

export default function validateNumber(options: NumberValidatorOptions): ValidationError[] {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;

    if (!isNumber(value)) {
        return [new ValidationError(key, value, `number expected, ${getType(value)} found`)];
    }

    // eslint-disable-next-line no-self-compare
    if (value !== value) {
        return [new ValidationError(key, value, `number expected, NaN found`)];
    }

    if ('minimum' in valueSpec) {
        let specMin = valueSpec.minimum;
        if (Array.isArray(valueSpec.minimum)) {
            const i = options.arrayIndex;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            specMin = valueSpec.minimum[i];
        }
        if (value < specMin) {
            return [new ValidationError(key, value, `${value} is less than the minimum value ${specMin}`)];
        }
    }

    if ('maximum' in valueSpec) {
        let specMax = valueSpec.maximum;
        if (Array.isArray(valueSpec.maximum)) {
            const i = options.arrayIndex;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            specMax = valueSpec.maximum[i];
        }
        if (value > specMax) {
            return [new ValidationError(key, value, `${value} is greater than the maximum value ${specMax}`)];
        }
    }

    return [];
}
