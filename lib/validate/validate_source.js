'use strict';

var ValidationError = require('../validation_error');
var unbundle = require('../unbundle');
var validateObject = require('./validate_object');
var validateEnum = require('./validate_enum');

module.exports = function validateSource(key, val, _, context) {
    if (!val.type) {
        return new ValidationError(key, val, '"type" is required');
    }

    var type = unbundle(val.type);
    switch (type) {
        case 'vector':
        case 'raster':
            var errors = [];
            errors = errors.concat(validateObject(key, val, context.reference.source_tile, context));
            if ('url' in val) {
                for (var prop in val) {
                    if (['type', 'url', 'tileSize'].indexOf(prop) < 0) {
                        errors.push(new ValidationError(key + '.' + prop, val[prop], 'a source with a "url" property may not include a "%s" property', prop));
                    }
                }
            }
            return errors;

        case 'geojson':
            return validateObject(key, val, context.reference.source_geojson, context);

        case 'video':
            return validateObject(key, val, context.reference.source_video, context);

        case 'image':
            return validateObject(key, val, context.reference.source_image, context);

        default:
            return validateEnum(key + '.type', val.type, {values: ['vector', 'raster', 'geojson', 'video', 'image']});
    }
};
