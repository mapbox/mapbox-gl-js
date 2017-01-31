'use strict';

const ValidationError = require('../error/validation_error');
const unbundle = require('../util/unbundle_jsonlint');
const validateObject = require('./validate_object');
const validateFilter = require('./validate_filter');
const validatePaintProperty = require('./validate_paint_property');
const validateLayoutProperty = require('./validate_layout_property');
const extend = require('../util/extend');

module.exports = function validateLayer(options) {
    let errors = [];

    const layer = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;

    if (!layer.type && !layer.ref) {
        errors.push(new ValidationError(key, layer, 'either "type" or "ref" is required'));
    }
    let type = unbundle(layer.type);
    const ref = unbundle(layer.ref);

    if (layer.id) {
        const layerId = unbundle(layer.id);
        for (let i = 0; i < options.arrayIndex; i++) {
            const otherLayer = style.layers[i];
            if (unbundle(otherLayer.id) === layerId) {
                errors.push(new ValidationError(key, layer.id, 'duplicate layer id "%s", previously used at line %d', layer.id, otherLayer.id.__line__));
            }
        }
    }

    if ('ref' in layer) {
        ['type', 'source', 'source-layer', 'filter', 'layout'].forEach((p) => {
            if (p in layer) {
                errors.push(new ValidationError(key, layer[p], '"%s" is prohibited for ref layers', p));
            }
        });

        let parent;

        style.layers.forEach((layer) => {
            if (unbundle(layer.id) === ref) parent = layer;
        });

        if (!parent) {
            errors.push(new ValidationError(key, layer.ref, 'ref layer "%s" not found', ref));
        } else if (parent.ref) {
            errors.push(new ValidationError(key, layer.ref, 'ref cannot reference another ref layer'));
        } else {
            type = unbundle(parent.type);
        }
    } else if (type !== 'background') {
        if (!layer.source) {
            errors.push(new ValidationError(key, layer, 'missing required property "source"'));
        } else {
            const source = style.sources && style.sources[layer.source];
            const sourceType = source && unbundle(source.type);
            if (!source) {
                errors.push(new ValidationError(key, layer.source, 'source "%s" not found', layer.source));
            } else if (sourceType === 'vector' && type === 'raster') {
                errors.push(new ValidationError(key, layer.source, 'layer "%s" requires a raster source', layer.id));
            } else if (sourceType === 'raster' && type !== 'raster') {
                errors.push(new ValidationError(key, layer.source, 'layer "%s" requires a vector source', layer.id));
            } else if (sourceType === 'vector' && !layer['source-layer']) {
                errors.push(new ValidationError(key, layer, 'layer "%s" must specify a "source-layer"', layer.id));
            }
        }
    }

    errors = errors.concat(validateObject({
        key: key,
        value: layer,
        valueSpec: styleSpec.layer,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            '*': function() {
                return [];
            },
            filter: validateFilter,
            layout: function(options) {
                return validateObject({
                    layer: layer,
                    key: options.key,
                    value: options.value,
                    style: options.style,
                    styleSpec: options.styleSpec,
                    objectElementValidators: {
                        '*': function(options) {
                            return validateLayoutProperty(extend({layerType: type}, options));
                        }
                    }
                });
            },
            paint: function(options) {
                return validateObject({
                    layer: layer,
                    key: options.key,
                    value: options.value,
                    style: options.style,
                    styleSpec: options.styleSpec,
                    objectElementValidators: {
                        '*': function(options) {
                            return validatePaintProperty(extend({layerType: type}, options));
                        }
                    }
                });
            }
        }
    }));

    return errors;
};
