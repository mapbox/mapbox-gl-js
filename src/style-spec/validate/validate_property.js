'use strict';

const validate = require('./validate');
const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');

module.exports = function validateProperty(options, propertyType) {
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const value = options.value;
    const propertyKey = options.objectKey;
    const layerSpec = styleSpec[`${propertyType}_${options.layerType}`];

    if (!layerSpec) return [];

    const transitionMatch = propertyKey.match(/^(.*)-transition$/);
    if (propertyType === 'paint' && transitionMatch && layerSpec[transitionMatch[1]] && layerSpec[transitionMatch[1]].transition) {
        return validate({
            key: key,
            value: value,
            valueSpec: styleSpec.transition,
            style: style,
            styleSpec: styleSpec
        });
    }

    const valueSpec = options.valueSpec || layerSpec[propertyKey];
    if (!valueSpec) {
        return [new ValidationError(key, value, 'unknown property "%s"', propertyKey)];
    }

    let tokenMatch;
    if (getType(value) === 'string' && valueSpec['property-function'] && !valueSpec.tokens && (tokenMatch = /^{([^}]+)}$/.exec(value))) {
        return [new ValidationError(key, value, '"%s" does not support interpolation syntax\n' +
            'Use an identity property function instead: `{ "type": "identity", "property": %s` }`.',
            propertyKey, JSON.stringify(tokenMatch[1]))];
    }

    const errors = [];

    if (options.layerType === 'symbol') {
        if (propertyKey === 'text-field' && style && !style.glyphs) {
            errors.push(new ValidationError(key, value, 'use of "text-field" requires a style "glyphs" property'));
        }
    }

    return errors.concat(validate({
        key: options.key,
        value: value,
        valueSpec: valueSpec,
        style: style,
        styleSpec: styleSpec
    }));
};
