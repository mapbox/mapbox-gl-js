'use strict';

var ValidationError = require('../error/validation_error');
var unbundle = require('../util/unbundle_jsonlint');
var validateObject = require('./validate_object');
var validateEnum = require('./validate_enum');

module.exports = function validateSource(options) {
    var value = options.value;
    var key = options.key;
    var styleSpec = options.styleSpec;
    var style = options.style;

    if (!value.type) {
        return [new ValidationError(key, value, '"type" is required')];
    }

    var type = unbundle(value.type);
    switch (type) {
        case 'vector':
        case 'raster':
            var errors = [];
            errors = errors.concat(validateObject({
                key: key,
                value: value,
                valueSpec: styleSpec.source_tile,
                style: options.style,
                styleSpec: styleSpec
            }));
            if ('url' in value) {
                for (var prop in value) {
                    if (['type', 'url', 'tileSize'].indexOf(prop) < 0) {
                        errors.push(new ValidationError(key + '.' + prop, value[prop], 'a source with a "url" property may not include a "%s" property', prop));
                    }
                }
            }
            return errors;

        case 'geojson':
            return validateObject({
                key: key,
                value: value,
                valueSpec: styleSpec.source_geojson,
                style: style,
                styleSpec: styleSpec
            });

        case 'video':
            return validateObject({
                key: key,
                value: value,
                valueSpec: styleSpec.source_video,
                style: style,
                styleSpec: styleSpec
            });

        case 'image':
            return validateObject({
                key: key,
                value: value,
                valueSpec: styleSpec.source_image,
                style: style,
                styleSpec: styleSpec
            });

        default:
            return validateEnum({
                key: key + '.type',
                value: value.type,
                valueSpec: {values: ['vector', 'raster', 'geojson', 'video', 'image']},
                style: style,
                styleSpec: styleSpec
            });
    }
};
