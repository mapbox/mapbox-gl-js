import ValidationError from '../error/validation_error';
import {getType, isObject} from '../util/get_type';
import validate from './validate';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type LightValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateLight(options: LightValidatorOptions): ValidationError[] {
    const light = options.value;
    const styleSpec = options.styleSpec;
    const lightSpec = styleSpec.light;
    const style = options.style;

    if (light === undefined) {
        return [];
    }

    if (!isObject(light)) {
        return [new ValidationError('light', light, `object expected, ${getType(light)} found`)];
    }

    let errors: ValidationError[] = [];
    for (const key in light) {
        const transitionMatch = key.match(/^(.*)-transition$/);
        const useThemeMatch = key.match(/^(.*)-use-theme$/);

        if (useThemeMatch && lightSpec[useThemeMatch[1]]) {
            errors = errors.concat(validate({
                key,
                value: light[key],
                valueSpec: {type: 'string'},
                style,
                styleSpec
            }));
        } else if (transitionMatch && lightSpec[transitionMatch[1]] && lightSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: light[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (lightSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: light[key],
                valueSpec: lightSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, light[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
