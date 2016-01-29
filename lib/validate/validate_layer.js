'use strict';

var ValidationError = require('../validation_error');
var unbundle = require('../unbundle');
var validateObject = require('./validate_object');
var validateFilter = require('./validate_filter');
var validatePaintProperty = require('./validate_paint_property');
var validateLayoutProperty = require('./validate_layout_property');

module.exports = function validateLayer(key, val, _, context) {
    var layers = context.layers;
    var style = context.style;
    var reference = context.reference;
    var errors = [];

    if (!val.type && !val.ref) {
        errors.push(new ValidationError(key, val, 'either "type" or "ref" is required'));
    }

    var type = unbundle(val.type),
        ref = unbundle(val.ref);

    if (val.id) {
        if (layers[val.id]) {
            errors.push(new ValidationError(key, val.id, 'duplicate layer id "%s", previously used at line %d', val.id, layers[val.id]));
        } else {
            layers[val.id] = val.id.__line__;
        }
    }

    if ('ref' in val) {
        ['type', 'source', 'source-layer', 'filter', 'layout'].forEach(function (p) {
            if (p in val) {
                errors.push(new ValidationError(key, val[p], '"%s" is prohibited for ref layers', p));
            }
        });

        var parent;

        style.layers.forEach(function(layer) {
            if (layer.id == ref) parent = layer;
        });

        if (!parent) {
            errors.push(new ValidationError(key, val.ref, 'ref layer "%s" not found', ref));
        } else if (parent.ref) {
            errors.push(new ValidationError(key, val.ref, 'ref cannot reference another ref layer'));
        } else {
            type = parent.type;
        }
    } else if (type !== 'background') {
        if (!val.source) {
            errors.push(new ValidationError(key, val, 'missing required property "source"'));
        } else {
            var source = style.sources[val.source];
            if (!source) {
                errors.push(new ValidationError(key, val.source, 'source "%s" not found', val.source));
            } else if (source.type == 'vector' && type == 'raster') {
                errors.push(new ValidationError(key, val.source, 'layer "%s" requires a raster source', val.id));
            } else if (source.type == 'raster' && type != 'raster') {
                errors.push(new ValidationError(key, val.source, 'layer "%s" requires a vector source', val.id));
            } else if (source.type == 'vector' && !val['source-layer']) {
                errors.push(new ValidationError(key, val, 'layer "%s" must specify a "source-layer"', val.id));
            }
        }
    }

    errors = errors.concat(validateObject(key, val, reference.layer, context, {
        filter: validateFilter,
        layout: function(key, val) {
            return validateLayoutProperty(type, key, val, context);
        },
        paint: function(key, val) {
            return validatePaintProperty(type, key, val, context);
        }
    }));

    return errors;
};
