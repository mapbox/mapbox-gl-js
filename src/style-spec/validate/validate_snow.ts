import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import getType from '../util/get_type';

import type {ValidationOptions} from './validate';

export default function validateSnow(options: ValidationOptions): Array<ValidationError> {
    const snow = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const snowSpec = styleSpec.snow;
    let errors = [];

    const rootType = getType(snow);
    if (snow === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('snow', snow, `object expected, ${rootType} found`)]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    }

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return errors;
}
