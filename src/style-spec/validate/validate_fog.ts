import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import {getType, isObject} from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type FogValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateFog(options: FogValidatorOptions): ValidationError[] {
    const fog = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const fogSpec = styleSpec.fog;

    if (fog === undefined) {
        return [];
    }

    if (!isObject(fog)) {
        return [new ValidationError('fog', fog, `object expected, ${getType(fog)} found`)];
    }

    let errors: ValidationError[] = [];
    for (const key in fog) {
        const transitionMatch = key.match(/^(.*)-transition$/);
        const useThemeMatch = key.match(/^(.*)-use-theme$/);

        if (useThemeMatch && fogSpec[useThemeMatch[1]]) {
            errors = errors.concat(validate({
                key,
                value: fog[key],
                valueSpec: {type: 'string'},
                style,
                styleSpec
            }));
        } else if (transitionMatch && fogSpec[transitionMatch[1]] && fogSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: fog[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (fogSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: fog[key],
                valueSpec: fogSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationWarning(key, fog[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
