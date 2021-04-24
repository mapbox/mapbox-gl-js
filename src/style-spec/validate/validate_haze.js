
import ValidationError from '../error/validation_error.js';
import validate from './validate.js';
import getType from '../util/get_type.js';

export default function validateHaze(options) {
    const haze = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const hazeSpec = styleSpec.haze;
    let errors = [];

    const rootType = getType(haze);
    if (haze === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('haze', haze, `object expected, ${rootType} found`)]);
        return errors;
    }

    if (haze.range && haze.range[0] >= haze.range[1]) {
        errors = errors.concat([new ValidationError('haze', haze, 'haze.range[0] can\'t be greater than or equal to haze.range[1]')]);
    }

    for (const key in haze) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && hazeSpec[transitionMatch[1]] && hazeSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: haze[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (hazeSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: haze[key],
                valueSpec: hazeSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, haze[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
