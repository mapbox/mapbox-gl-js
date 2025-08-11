import {getType, isBoolean} from '../util/get_type';
import ValidationError from '../error/validation_error';

type BooleanValidatorOptions = {
    key: string;
    value: unknown;
};

export default function validateBoolean(options: BooleanValidatorOptions): ValidationError[] {
    const value = options.value;
    const key = options.key;
    if (!isBoolean(value)) {
        return [new ValidationError(key, value, `boolean expected, ${getType(value)} found`)];
    }

    return [];
}
