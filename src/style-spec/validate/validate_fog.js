
import ValidationError from '../error/validation_error.js';
import validate from './validate.js';
import getType from '../util/get_type.js';

export default function validateFog(options) {
    const fog = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const fogSpec = styleSpec.fog;
    let errors = [];

    const rootType = getType(fog);
    if (fog === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('fog', fog, `object expected, ${rootType} found`)]);
        return errors;
    }

    for (const key in fog) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && fogSpec[transitionMatch[1]] && fogSpec[transitionMatch[1]].transition) {
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
            errors = errors.concat([new ValidationError(key, fog[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
