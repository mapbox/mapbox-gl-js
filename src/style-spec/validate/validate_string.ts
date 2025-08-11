import {getType, isString} from '../util/get_type';
import ValidationError from '../error/validation_error';

type StringValidatorOptions = {
    key: string;
    value: unknown;
};

export default function validateString({key, value}: StringValidatorOptions): ValidationError[] {
    if (isString(value)) {
        return [];
    }

    return [new ValidationError(key, value, `string expected, ${getType(value)} found`)];
}
