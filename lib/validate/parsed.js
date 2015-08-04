'use strict';

var parseCSSColor = require('csscolorparser').parseCSSColor;
var format = require('util').format;

module.exports = function(style, reference) {

    var constants = style.constants || {},
        layers = {},
        errors = [];

    function error(key, val /*, message, ...*/) {
        var err = {
            message: (key ? key + ': ' : '') +
            format.apply(format, Array.prototype.slice.call(arguments, 2))
        };

        if (val !== null && val !== undefined && val.__line__) {
            err.line = val.__line__;
        }

        errors.push(err);
    }

    // Main recursive validation function. Tracks:
    //
    // - key: string representing location of validation in style tree. Used only
    //   for more informative error reporting.
    // - val: current value from style being evaluated. May be anything from a
    //   high level object that needs to be descended into deeper or a simple
    //   scalar value.
    // - spec: current spec being evaluated. Tracks val.
    //
    function validate(key, val, spec) {
        var type = typeof_(val);

        // Constants
        if (type === 'string' && val[0] === '@') {
            if (!(val in constants)) {
                return error(key, val, 'constant "%s" not found', val);
            }
            // v8 introduced typed constants
            if (reference.$version > 7) {
                val = constants[val].value;
            } else {
                val = constants[val];
            }
            type = typeof_(val);
        }

        if (spec.function && type === 'object') {
            return validate.function(key, val, spec);
        }

        if (spec.type) {
            var validator = validate[spec.type];
            if (validator) {
                return validator(key, val, spec);
            }
            spec = reference[spec.type];
        }

        validate.object(key, val, spec);
    }

    validate.constants = function(key, val) {
        var type = typeof_(val);
        if (type !== 'object') {
            return error(key, val, 'object expected, %s found', type);
        }

        for (var k in val) {
            if (k[0] !== '@') {
                error(key + '.' + k, val[k], 'constants must start with "@"');
            }
            if (reference.$version > 7) {
                if (typeof val[k] === 'object') {
                    if (val[k].type === undefined) {
                        error(key + '.' + k, val[k], 'constant must have type property');
                    }
                    if (val[k].value === undefined) {
                        error(key + '.' + k, val[k], 'constant must have value property');
                    }
                } else {
                    error(key + '.' + k, val[k], 'constants must be objects with type and value keys');
                }
            }
        }
    };

    validate.source = function(key, val) {
        if (!val.type) {
            error(key, val, '"type" is required');
            return;
        }

        var type = unbundle(val.type);
        switch (type) {
            case 'vector':
            case 'raster':
                validate.object(key, val, reference.source_tile);

                if ('url' in val) {
                    for (var prop in val) {
                        if (['type', 'url', 'tileSize'].indexOf(prop) < 0) {
                            error(key + '.' + prop, val[prop], 'a source with a "url" property may not include a "%s" property', prop);
                        }
                    }
                }

                break;
            case 'geojson':
                validate.object(key, val, reference.source_geojson);
                break;
            case 'video':
                validate.object(key, val, reference.source_video);
                break;
            default:
                validate.enum(key + '.type', val.type, {values: ['vector', 'raster', 'geojson', 'video']});
        }
    };

    validate.layer = function(key, val) {
        if (!val.type && !val.ref) {
            error(key, val, 'either "type" or "ref" is required');
        }

        var type = unbundle(val.type),
            ref = unbundle(val.ref);

        if (val.id) {
            if (layers[val.id]) {
                error(key, val.id, 'duplicate layer id "%s", previously used at line %d', val.id, layers[val.id]);
            } else {
                layers[val.id] = val.id.__line__;
            }
        }

        if ('ref' in val) {
            ['type', 'source', 'source-layer', 'filter', 'layout'].forEach(function (p) {
                if (p in val) {
                    error(key, val[p], '"%s" is prohibited for ref layers', p);
                }
            });

            var parent;

            style.layers.forEach(function(layer) {
                if (layer.id == ref) parent = layer;
            });

            if (!parent) {
                error(key, val.ref, 'ref layer "%s" not found', ref);
            } else if (parent.ref) {
                error(key, val.ref, 'ref cannot reference another ref layer');
            } else {
                type = parent.type;
            }
        } else if (type !== 'background') {
            if (!val.source) {
                error(key, val, 'missing required property "source"');
            } else {
                var source = style.sources[val.source];
                if (!source) {
                    error(key, val.source, 'source "%s" not found', val.source);
                } else if (source.type == 'vector' && type == 'raster') {
                    error(key, val.source, 'layer "%s" requires a raster source', val.id);
                } else if (source.type == 'raster' && type != 'raster') {
                    error(key, val.source, 'layer "%s" requires a vector source', val.id);
                }
            }
        }

        validate.object(key, val, reference.layer, {
            filter: validate.filter,
            layout: function(key, val) {
                var spec = reference['layout_' + type];
                return type && spec && validate(key, val, spec);
            },
            paint: function(key, val) {
                var spec = reference['paint_' + type];
                return type && spec && validate(key, val, spec);
            }
        });
    };

    validate.object = function (key, val, spec, validators) {
        validators = validators || {};

        var type = typeof_(val);
        if (type !== 'object') {
            return error(key, val, 'object expected, %s found', type);
        }

        for (var k in val) {
            var speckey = k.split('.')[0]; // treat 'paint.*' as 'paint'
            var def = spec[speckey] || spec['*'];
            var transition = speckey.match(/^(.*)-transition$/);

            if (def) {
                (validators[speckey] || validate)((key ? key + '.' : key) + k, val[k], def);
            } else if (transition && spec[transition[1]] && spec[transition[1]].transition) {
                validate((key ? key + '.' : key) + k, val[k], reference.transition);
            // tolerate root-level extra keys & arbitrary layer properties
            } else if (key !== '' && key.split('.').length !== 1) {
                error(key, val[k], 'unknown property "%s"', k);
            }
        }

        for (var l in spec) {
            if (spec[l].required && spec[l]['default'] === undefined && val[l] === undefined) {
                error(key, val, 'missing required property "%s"', l);
            }
        }
    };

    validate.array = function (key, val, spec, validator) {
        if (typeof_(val) !== 'array') {
            return error(key, val, 'array expected, %s found', typeof_(val));
        }

        if (spec.length && val.length !== spec.length) {
            return error(key, val, 'array length %d expected, length %d found', spec.length, val.length);
        }

        if (spec['min-length'] && val.length < spec['min-length']) {
            return error(key, val, 'array length at least %d expected, length %d found', spec['min-length'], val.length);
        }

        var value = {
            "type": spec.value
        };

        if (style.version < 7) {
            value.function = spec.function;
        }

        if (typeof_(spec.value) === 'object') {
            value = spec.value;
        }

        for (var i = 0; i < val.length; i++) {
            (validator || validate)(key + '[' + i + ']', val[i], value);
        }
    };


    validate.filter = function(key, val) {
        var type;

        if (typeof_(val) !== 'array') {
            return error(key, val, 'array expected, %s found', typeof_(val));
        }

        if (val.length < 1) {
            return error(key, val, 'filter array must have at least 1 element');
        }

        validate.enum(key + '[0]', val[0], reference.filter_operator);

        switch (unbundle(val[0])) {
            case '<':
            case '<=':
            case '>':
            case '>=':
                if (val.length >= 2 && val[1] == '$type') {
                    error(key, val, '"$type" cannot be use with operator "%s"', val[0]);
                }
            /* falls through */
            case '==':
            case '!=':
                if (val.length != 3) {
                    error(key, val, 'filter array for operator "%s" must have 3 elements', val[0]);
                }
            /* falls through */
            case 'in':
            case '!in':
                if (val.length >= 2) {
                    type = typeof_(val[1]);
                    if (type !== 'string') {
                        error(key + '[1]', val[1], 'string expected, %s found', type);
                    } else if (val[1][0] === '@') {
                        error(key + '[1]', val[1], 'filter key cannot be a constant');
                    }
                }
                for (var i = 2; i < val.length; i++) {
                    type = typeof_(val[i]);
                    if (val[1] == '$type') {
                        validate.enum(key + '[' + i + ']', val[i], reference.geometry_type);
                    } else if (type === 'string' && val[i][0] === '@') {
                        error(key + '[' + i + ']', val[i], 'filter value cannot be a constant');
                    } else if (type !== 'string' && type !== 'number' && type !== 'boolean') {
                        error(key + '[' + i + ']', val[i], 'string, number, or boolean expected, %s found', type);
                    }
                }
                break;

            case 'any':
            case 'all':
            case 'none':
                for (i = 1; i < val.length; i++) {
                    validate.filter(key + '[' + i + ']', val[i]);
                }
                break;
        }
    };

    validate.function = function(key, val, spec) {
        validate.object(key, val, reference.function, {
            stops: function (key, val, arraySpec) {
                var lastStop = -Infinity;
                validate.array(key, val, arraySpec, function validateStop(key, val) {
                    if (typeof_(val) !== 'array') {
                        return error(key, val, 'array expected, %s found', typeof_(val));
                    }

                    if (val.length !== 2) {
                        return error(key, val, 'array length %d expected, length %d found', 2, val.length);
                    }

                    validate(key + '[0]', val[0], {type: 'number'});
                    validate(key + '[1]', val[1], spec);

                    if (typeof_(val[0]) === 'number') {
                        if (spec.function === 'discrete' && val[0] % 1 !== 0) {
                            error(key + '[0]', val[0], 'zoom level for discrete functions must be an integer');
                        }

                        if (val[0] < lastStop) {
                            error(key + '[0]', val[0], 'array stops must appear in ascending order');
                        }

                        lastStop = val[0];
                    }
                });

                if (typeof_(val) === 'array' && val.length === 0) {
                    error(key, val, 'array must have at least one stop');
                }
            }
        });
    };

    validate.enum = function (key, val, spec) {
        if (spec.values.indexOf(unbundle(val)) === -1) {
            error(key, val, 'expected one of [%s], %s found', spec.values.join(', '), val);
        }
    };

    validate.color = function(key, val) {
        var type = typeof_(val);
        if (type !== 'string' && type !== 'array') {
            error(key, val, 'color expected, %s found', type);
        } else if (type === 'string') {
            if (reference.$version > 7) {
                if (val[0] === '@' && constants[val]) val = constants[val].value;
            } else {
                if (val[0] === '@' && constants[val]) val = constants[val];
            }
            if (parseCSSColor(val) === null) {
                error(key, val, 'color expected, "%s" found', val);
            }
        } else {
            validate.enum(key + '[0]', val[0], reference.color_operation);

            if (isNaN(val[1])) {
                error(key, val, 'number expected, "%s" found', val[1]);
            }

            validate.color(key, val[2]);

            if (unbundle(val[0]) === 'mix') {
                if (val[3] === undefined) {
                    error(key, val, 'mix must have two colors, only found one');
                } else {
                   validate.color(key, val[3]);
                }
            }
        }
    };

    function typeValidator(expected) {
        return function(key, val, spec) {
            var actual = typeof_(val);
            if (actual !== expected) {
                error(key, val, '%s expected, %s found', expected, actual);
            }

            if ('minimum' in spec && val < spec.minimum) {
                error(key, val, '%s is less than the minimum value %s', val, spec.minimum);
            }

            if ('maximum' in spec && val > spec.maximum) {
                error(key, val, '%s is greater than the maximum value %s', val, spec.maximum);
            }
        };
    }

    validate.number = typeValidator('number');
    validate.string = typeValidator('string');
    validate.boolean = typeValidator('boolean');

    // new types in v8
    validate['font-array'] = validate.array;
    validate['field-template'] = typeValidator('string');
    validate.opacity = typeValidator('number');
    validate['translate-array'] = validate.array;
    validate['offset-array'] = validate.array;
    validate['dash-array'] = validate.array;
    validate['icon-translate'] = validate.array;
    validate['text-translate'] = validate.array;

    // new enums in v8
    validate['line-cap-enum'] =
    validate['line-join-enum'] =
    validate['symbol-placement-enum'] =
    validate['rotation-alignment-enum'] =
    validate['text-justify-enum'] =
    validate['text-anchor-enum'] =
    validate['text-transform-enum'] =
    validate['visibility-enum'] = validate.enum;

    validate['*'] = function() {};

    validate('', style, reference.$root);

    return errors;
};

function typeof_(val) {
    if (val instanceof Number)
        return 'number';
    if (val instanceof String)
        return 'string';
    if (val instanceof Boolean)
        return 'boolean';
    if (Array.isArray(val))
        return 'array';
    if (val === null)
        return 'null';
    return typeof val;
}

function unbundle(_) {
    if (_ instanceof Number ||
        _ instanceof String ||
        _ instanceof Boolean) {
        return _.valueOf();
    } else {
        return _;
    }
}
