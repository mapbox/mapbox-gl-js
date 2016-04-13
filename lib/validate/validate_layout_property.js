'use strict';

var validate = require('./validate');
var ValidationError = require('../error/validation_error');

module.exports = function validateLayoutProperty(options) {
    var key = options.key;
    var style = options.style;
    var styleSpec = options.styleSpec;
    var value = options.value;
    var propertyKey = options.objectKey;
    var layerSpec = styleSpec['layout_' + options.layerType];

    if (options.valueSpec || layerSpec[propertyKey]) {
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
            valueSpec: options.valueSpec || layerSpec[propertyKey],
            style: style,
            styleSpec: styleSpec
        }));

    } else {
        return [new ValidationError(key, value, 'unknown property "%s"', propertyKey)];
    }

};
