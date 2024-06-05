import getType from '../util/get_type';
import ValidationError from '../error/validation_error';

import type {ValidationOptions} from './validate';

type Options = ValidationOptions & {
    arrayIndex: number;
};

export default function validateNumber(options: Options): Array<ValidationError> {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;
    let type = getType(value);

    // eslint-disable-next-line no-self-compare
    if (type === 'number' && value !== value) {
        type = 'NaN';
    }

    if (type !== 'number') {
        return [new ValidationError(key, value, `number expected, ${type} found`)];
    }

    if ('minimum' in valueSpec) {
        let specMin = valueSpec.minimum;
        if (getType(valueSpec.minimum) === 'array') {
            const i = options.arrayIndex;
            specMin = valueSpec.minimum[i];
        }
        if (value < specMin) {
            return [new ValidationError(key, value, `${value} is less than the minimum value ${specMin}`)];
        }
    }

    if ('maximum' in valueSpec) {
        let specMax = valueSpec.maximum;
        if (getType(valueSpec.maximum) === 'array') {
            const i = options.arrayIndex;
            specMax = valueSpec.maximum[i];
        }
        if (value > specMax) {
            return [new ValidationError(key, value, `${value} is greater than the maximum value ${specMax}`)];
        }
    }

    return [];
}
