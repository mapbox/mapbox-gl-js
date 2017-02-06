'use strict';

const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');
const validate = require('./validate');

module.exports = function validateLight(options) {
    const light = options.value;
    const styleSpec = options.styleSpec;
    const lightSpec = styleSpec.light;
    const style = options.style;

    let errors = [];

    const rootType = getType(light);
    if (light === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('light', light, 'object expected, %s found', rootType)]);
        return errors;
    }

    for (const key in light) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && lightSpec[transitionMatch[1]] && lightSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key: key,
                value: light[key],
                valueSpec: styleSpec.transition,
                style: style,
                styleSpec: styleSpec
            }));
        } else if (lightSpec[key]) {
            errors = errors.concat(validate({
                key: key,
                value: light[key],
                valueSpec: lightSpec[key],
                style: style,
                styleSpec: styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, light[key], 'unknown property "%s"', key)]);
        }
    }

    return errors;
};
