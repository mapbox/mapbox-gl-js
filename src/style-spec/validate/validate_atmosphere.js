
import ValidationError from '../error/validation_error.js';
import validate from './validate.js';
import getType from '../util/get_type.js';
import {isExpression} from '../expression/index.js';
import {deepUnbundle} from '../util/unbundle_jsonlint.js';

export default function validateAtmosphere(options) {
    const atmosphere = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const atmosphereSpec = styleSpec.atmosphere;
    let errors = [];

    const rootType = getType(atmosphere);
    if (atmosphere === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('atmosphere', atmosphere, `object expected, ${rootType} found`)]);
        return errors;
    }

    if (atmosphere['fog-range'] && !isExpression(deepUnbundle(atmosphere['fog-range'])) && atmosphere['fog-range'][0] >= atmosphere['fog-range'][1]) {
        errors = errors.concat([new ValidationError('atmosphere', atmosphere, 'atmosphere.fog-range[0] can\'t be greater than or equal to atmosphere.fog-range[1]')]);
    }

    for (const key in atmosphere) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && atmosphereSpec[transitionMatch[1]] && atmosphereSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: atmosphere[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (atmosphereSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: atmosphere[key],
                valueSpec: atmosphereSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, atmosphere[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
