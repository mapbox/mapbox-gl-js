'use strict';

var ValidationError = require('../validation_error');
var unbundle = require('../unbundle');
var validateObject = require('./validate_object');
var validateFilter = require('./validate_filter');
var validatePaintProperty = require('./validate_paint_property');
var validateLayoutProperty = require('./validate_layout_property');

module.exports = function validateLayer(key, layer, _, context) {
    var errors = [];
    if (!layer.type && !layer.ref) {
        errors.push(new ValidationError(key, layer, 'either "type" or "ref" is required'));
    }

    var style = context.style;
    var reference = context.reference;
    var type = unbundle(layer.type);
    var ref = unbundle(layer.ref);

    if (layer.id) {
        var isFirstMatch = true;
        style.layers.forEach(function(otherLayer) {
            if (unbundle(otherLayer.id) === unbundle(layer.id)) {
                if (!isFirstMatch && layer.id.__line__ !== otherLayer.id.__line__) {
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

    errors = errors.concat(validateObject(key, layer, reference.layer, context, {
        filter: validateFilter,
        layout: function(key, value) {
            return validateLayoutProperty(type, key, value, context);
        },
        paint: function(key, value) {
            return validatePaintProperty(type, key, value, context);
        }
    }));

    return errors;
};
