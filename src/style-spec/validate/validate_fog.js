
import ValidationError from '../error/validation_error.js';
import validate from './validate.js';
import getType from '../util/get_type.js';
import {parseCSSColor} from 'csscolorparser';

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

    if (fog.color && !Array.isArray(fog.color)) {
        const fogColor = parseCSSColor(fog.color);
        if (fogColor && fogColor[3] === 0) {
            errors = errors.concat([new ValidationError('fog', fog, 'fog.color alpha must be nonzero.')]);
        }
    }

    if (fog.range) {
        const isExpression = fog.range[0] instanceof String;
        if (!isExpression && fog.range[0] >= fog.range[1]) {
            errors = errors.concat([new ValidationError('fog', fog, 'fog.range[0] can\'t be greater than or equal to fog.range[1]')]);
        }
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
