
const ValidationError = require('../error/validation_error');
const unbundle = require('../util/unbundle_jsonlint');
const validateObject = require('./validate_object');
const validateEnum = require('./validate_enum');

module.exports = function validateSource(options) {
    const value = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (!value.type) {
        return [new ValidationError(key, value, '"type" is required')];
    }

    const type = unbundle(value.type);
    let errors = [];

    switch (type) {
    case 'vector':
    case 'raster':
    case 'raster-dem':
        errors = errors.concat(validateObject({
            key: key,
            value: value,
            valueSpec: styleSpec[`source_${type.replace('-', '_')}`],
            style: options.style,
            styleSpec: styleSpec
        }));
        if ('url' in value) {
            for (const prop in value) {
                if (['type', 'url', 'tileSize'].indexOf(prop) < 0) {
                    errors.push(new ValidationError(`${key}.${prop}`, value[prop], `a source with a "url" property may not include a "${prop}" property`));
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

    case 'canvas':
        return validateObject({
            key: key,
            value: value,
            valueSpec: styleSpec.source_canvas,
            style: style,
            styleSpec: styleSpec
        });

    default:
        return validateEnum({
            key: `${key}.type`,
            value: value.type,
            valueSpec: {values: ['vector', 'raster', 'raster-dem', 'geojson', 'video', 'image', 'canvas']},
            style: style,
            styleSpec: styleSpec
        });
    }
};
