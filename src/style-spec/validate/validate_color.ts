import ValidationError from '../error/validation_error';
import {getType, isString} from '../util/get_type';
import {unbundle} from '../util/unbundle_jsonlint';
import Color from '../util/color';

type ColorValidatorOptions = {
    key: string;
    value: unknown;
};

export default function validateColor({key, value}: ColorValidatorOptions): ValidationError[] {
    if (!isString(value)) {
        return [new ValidationError(key, value, `color expected, ${getType(value)} found`)];
    }

    // `value` may be a jsonlint-lines-primitives `String` wrapper; unbundle to a
    // primitive so `Color.parse`'s `typeof input === 'string'` check passes.
    if (Color.parse(unbundle(value) as string) === undefined) {
        return [new ValidationError(key, value, `color expected, "${value}" found`)];
    }

    return [];
}
