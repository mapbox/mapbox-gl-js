
import ValidationError from '../error/validation_error.js';
import validate from './validate.js';
import getType from '../util/get_type.js';
import {isExpression} from '../expression/index.js';
import {deepUnbundle} from '../util/unbundle_jsonlint.js';

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

    if (fog.range && !isExpression(deepUnbundle(fog.range)) && fog.range[0] >= fog.range[1]) {
        errors = errors.concat([new ValidationError('fog', fog, 'fog.range[0] can\'t be greater than or equal to fog.range[1]')]);
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
