import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import getType from '../util/get_type';

import type {ValidationOptions} from './validate';

export default function validateFog(options: ValidationOptions): Array<ValidationError> {
    const fog = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const fogSpec = styleSpec.fog;
    let errors = [];

    const rootType = getType(fog);
    if (fog === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('fog', fog, `object expected, ${rootType} found`)]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    }

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return errors;
}
