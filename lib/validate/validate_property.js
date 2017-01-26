'use strict';

var validate = require('./validate');
var ValidationError = require('../error/validation_error');

module.exports = function validateProperty(options, propertyType) {
    var key = options.key;
    var style = options.style;
    var styleSpec = options.styleSpec;
    var value = options.value;
    var propertyKey = options.objectKey;
    var layerSpec = styleSpec[propertyType + '_' + options.layerType];

    if (!layerSpec) return [];

    var transitionMatch = propertyKey.match(/^(.*)-transition$/);
    if (propertyType == 'paint' && transitionMatch && layerSpec[transitionMatch[1]] && layerSpec[transitionMatch[1]].transition) {
        return validate({
            key: key,
            value: value,
            valueSpec: styleSpec.transition,
            style: style,
            styleSpec: styleSpec
        });
    }

    var valueSpec = options.valueSpec || layerSpec[propertyKey];
    if (!valueSpec) {
        return [new ValidationError(key, value, 'unknown property "%s"', propertyKey)];
    }

    var errors = [];

    if (options.layerType === 'symbol') {
        if (propertyKey === 'icon-image' && style && !style.sprite) {
            errors.push(new ValidationError(key, value, 'use of "icon-image" requires a style "sprite" property'));
        } else if (propertyKey === 'text-field' && style && !style.glyphs) {
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
