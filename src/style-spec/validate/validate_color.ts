import ValidationError from '../error/validation_error';
import {getType, isString} from '../util/get_type';
import {parseCSSColor} from 'csscolorparser';

type ColorValidatorOptions = {
    key: string;
    value: unknown;
};

export default function validateColor({key, value}: ColorValidatorOptions): ValidationError[] {
    if (!isString(value)) {
        return [new ValidationError(key, value, `color expected, ${getType(value)} found`)];
    }

    if (parseCSSColor(value) === null) {
        return [new ValidationError(key, value, `color expected, "${value}" found`)];
    }

    return [];
}
