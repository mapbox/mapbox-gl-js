'use strict';

var ValidationError = require('../validation_error');
var unbundle = require('../unbundle');
var validateObject = require('./validate_object');
var validateFilter = require('./validate_filter');
var validatePaintProperty = require('./validate_paint_property');
var validateLayoutProperty = require('./validate_layout_property');
var latestStyleSpec = require('../../reference/latest.min');

module.exports = function validateLayer(options) {
    var errors = [];

    var layer = options.value;
    var key = options.key;
    var style = options.style;
    var styleSpec = options.styleSpec || latestStyleSpec;

    if (!layer.type && !layer.ref) {
        errors.push(new ValidationError(key, layer, 'either "type" or "ref" is required'));
    }
    var type = unbundle(layer.type);
    var ref = unbundle(layer.ref);

    if (layer.id) {
        var isFirstMatch = true;
        style.layers.forEach(function(otherLayer) {
            if (unbundle(otherLayer.id) === unbundle(layer.id)) {
                if (!isFirstMatch) {
                    errors.push(new ValidationError(key, layer.id, 'duplicate layer id "%s", used at line %d and line %d', layer.id, layer.id.__line__, otherLayer.id.__line__));
                }
                isFirstMatch = false;
            }
        });
    }

    if ('ref' in layer) {
        ['type', 'source', 'source-layer', 'filter', 'layout'].forEach(function (p) {
            if (p in layer) {
                errors.push(new ValidationError(key, layer[p], '"%s" is prohibited for ref layers', p));
            }
        });

        var parent;

        style.layers.forEach(function(layer) {
            if (layer.id == ref) parent = layer;
        });

        if (!parent) {
            errors.push(new ValidationError(key, layer.ref, 'ref layer "%s" not found', ref));
        } else if (parent.ref) {
            errors.push(new ValidationError(key, layer.ref, 'ref cannot reference another ref layer'));
        } else {
            type = parent.type;
        }
    } else if (type !== 'background') {
        if (!layer.source) {
            errors.push(new ValidationError(key, layer, 'missing required property "source"'));
        } else {
            var source = style.sources[layer.source];
            if (!source) {
                errors.push(new ValidationError(key, layer.source, 'source "%s" not found', layer.source));
            } else if (source.type == 'vector' && type == 'raster') {
                errors.push(new ValidationError(key, layer.source, 'layer "%s" requires a raster source', layer.id));
            } else if (source.type == 'raster' && type != 'raster') {
                errors.push(new ValidationError(key, layer.source, 'layer "%s" requires a vector source', layer.id));
            } else if (source.type == 'vector' && !layer['source-layer']) {
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
            filter: validateFilter,
            layout: function(options) {
                return validateLayoutProperty({
                    layer: layer,
                    key: options.key,
                    value: options.value,
                    style: options.style,
                    styleSpec: options.styleSpec
                });
            },
            paint: function(options) {
                return validatePaintProperty({
                    layer: layer,
                    key: options.key,
                    value: options.value,
                    style: options.style,
                    styleSpec: options.styleSpec
                });
            }
        }
    }));

    return errors;
};
