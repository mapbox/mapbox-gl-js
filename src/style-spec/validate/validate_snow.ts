import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import {getType, isObject} from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type SnowValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateSnow(options: SnowValidatorOptions): ValidationError[] {
    const snow = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const snowSpec = styleSpec.snow;

    if (snow === undefined) {
        return [];
    }

    if (!isObject(snow)) {
        return [new ValidationError('snow', snow, `object expected, ${getType(snow)} found`)];
    }

    let errors: ValidationError[] = [];
    for (const key in snow) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && snowSpec[transitionMatch[1]] && snowSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: snow[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (snowSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: snow[key],
                valueSpec: snowSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationWarning(key, snow[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
