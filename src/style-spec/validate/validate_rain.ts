import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import getType from '../util/get_type';

import type {ValidationOptions} from './validate';

export default function validateRain(options: ValidationOptions): Array<ValidationError> {
    const rain = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const rainSpec = styleSpec.rain;
    let errors = [];

    const rootType = getType(rain);
    if (rain === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('rain', rain, `object expected, ${rootType} found`)]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    }

    for (const key in rain) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && rainSpec[transitionMatch[1]] && rainSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: rain[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (rainSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: rain[key],
                valueSpec: rainSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationWarning(key, rain[key], `unknown property "${key}"`)]);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return errors;
}
