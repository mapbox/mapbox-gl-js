'use strict';

var jsonlint = require('jsonlint-lines-primitives');
var reference = require('mapbox-gl-style-spec/reference/v5');
var parseCSSColor = require('csscolorparser').parseCSSColor;
var format = require('util').format;

module.exports = function(str) {
    var style;

    try {
        style = jsonlint.parse(str.toString());
    } catch(e) {
        var match = e.message.match(/line (\d+)/),
            lineNumber = 0;
        if (match) lineNumber = parseInt(match[1], 10);
        return [{
            line: lineNumber - 1,
            message: e.message,
            error: e
        }];
    }

    var constants = style.constants || {},
        layers = {},
        errors = [];

    function error(key, val, message) {
        var args = Array.prototype.slice.call(arguments, 3);
        args.unshift(message);
        message = format.apply(format, args);
        errors.push({
            line: val.__line__,
            message: (key ? key + ': ' : '') + message
        });
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
            val = constants[val];
            type = typeof_(val);
        }

        // Functions
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
            ['type', 'source', 'source-layer', 'filter', 'render'].forEach(function (p) {
                if (p in val) {
                    error(key, val[p], '"%s" is prohibited for ref layers', p);
                }
            });

            var parent;

            style.layers.forEach(function(layer) {
                if (layer.id == ref) parent = layer;
            });

            if (parent) {
                type = parent.type;
            } else {
                error(key, val.ref, 'ref layer "%s" not found', ref);
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
            render: function(key, val) {
                return type && validate(key, val, reference['render_' + type]);
            },
            style: function(key, val) {
                return type && validate(key, val, reference['class_' + type]);
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
            var speckey = k.split('.')[0]; // treat 'style.*' as 'style'
            var def = spec[speckey] || spec['*'];
            if (def) {
                (validators[speckey] || validate)((key ? key + '.' : key) + k, val[k], def);
            } else {
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

        for (var i = 0; i < val.length; i++) {
            (validator || validate)(key + '[' + i + ']', val[i], {type: spec.value});
        }
    };

    validate.filter = function(/*key, val, spec*/) {
        // TODO
    };

    validate.function = function(key, val, spec) {
        validate.object(key, val, reference.function, {
            stops: function (key, val, arraySpec) {
                validate.array(key, val, arraySpec, function validateStop(key, val) {
                    if (typeof_(val) !== 'array') {
                        return error(key, val, 'array expected, %s found', typeof_(val));
                    }

                    if (val.length !== 2) {
                        return error(key, val, 'array length %d expected, length %d found', 2, val.length);
                    }

                    validate(key + '[0]', val[0], {type: 'number'});
                    validate(key + '[1]', val[1], spec);
                });
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
        if (type !== 'string') {
            error(key, val, 'color expected, %s found', type);
        } else if (parseCSSColor(val) === null) {
            error(key, val, 'color expected, "%s" found', val);
        }
    };

    validate.number = validate.string = validate.boolean = function(key, val, spec) {
        var type = typeof_(val);
        if (type !== spec.type) {
            error(key, val, '%s expected, %s found', spec.type, type);
        }
    };

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
    if (val === 'null')
        return 'null';
    return typeof(val);
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
