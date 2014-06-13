'use strict';
var jsonlint = require('jsonlint-lines');
var isEqual = require('lodash.isequal');
var reference = require('./reference');

module.exports = validate;
module.exports.v = v;

function v(key, obj, constants, ref, spec, errors) {
    // Resolve constants.
    if (typeof obj === 'string' && constants[obj]) obj = constants[obj];

    // Spec is for a JS native type.
    if (typeof spec === 'string') {
        if (typeof obj !== spec && spec !== '*') {
            errors.push(key + ' does not match required type ' + spec);
            return false;
        } else {
            return true;
        }
    }

    // Spec is an enumeration of specific values that obj may match.
    if (Array.isArray(spec) && typeof spec[0] !== 'object') {
        if (spec.indexOf(obj) === -1) {
            errors.push(key + ' is not one of ' + spec);
            return false;
        } else {
            return true;
        }
    }

    // Spec is an array of definitions that obj may match.
    if (Array.isArray(spec) && typeof spec[0] === 'object') {
        var sub = [];
        var valid = spec.some(function(s, i) {
            return v(key, obj, constants, ref, s, sub);
        });
        if (!valid) sub.forEach(function(err) { errors.push(err); });
        return valid;
    }

    // Spec is an object defining what obj may match.
    if (spec.type) {
        var type = Array.isArray(obj) ? 'array' : typeof obj;

        // The defined type for validation goes beyond a JS native type.
        // Validate against its reference definition.
        if (spec.type && ref[spec.type]) {
            return v(key, obj, constants, ref, ref[spec.type], errors);
        // An array of defined types.
        } else if (spec.type === 'array' && spec.value) {
            if (type === 'array') {
                var pass = true;
                for (var i = 0; i < obj.length; i++) {
                    pass = v(key + '[' + i + ']', obj[i], constants, ref, ref[spec.value]||spec.value, errors) && pass;
                }
                return pass;
            } else {
                errors.push(new Error(key + ' must be an array'));
                return false;
            }
        // A straight up array.
        } else if (spec.type === 'array') {
            if (type === 'array') {
                return true;
            } else {
                errors.push(key + ' must be an array');
                return false;
            }
        // Functions are allowed for this value.
        } else if (spec.function) {
            return v(key, obj, constants, ref, ref.style_fn, errors) || v(key, obj, constants, ref, spec.type, errors);
        // All other values.
        } else {
            return v(key, obj, constants, ref, spec.type, errors);
        }
    }

    // Spec is a container object -- obj must be an object and must have
    // keys matching the container object definition.
    var pass = true;
    for (var k in obj) {
        var childkey = (key ? key + '.' : key) + k;
        var def = spec[k] || spec['*'] || undefined;
        if (!def) {
            errors.push(new Error('Unknown key at ' + childkey));
            continue;
        }
        pass = v(childkey, obj[k], constants, ref, def, errors) && pass;
    }
    return pass;
};

function validate(str) {
    var style, errors = [];
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

    requiredEqual(style, 'version', '1', errors);

    if (typeof style.sprite !== 'undefined' &&
        typeof style.sprite !== 'string') {
        errors.push({
            message: 'sprite property of style must be a string',
            line: style.__line__
        });
    }

    if (!requiredProperty(style, 'buckets', 'object', errors)) {
        for (var bucket in style.buckets) {
            requiredProperty(style.buckets[bucket], 'filter', 'object', errors);
            for (var prop in style.buckets[bucket]) {
                var bucketErr = reference.validate.bucket(prop,
                    style.buckets[bucket][prop],
                    style.buckets[bucket].__line__);
                if (bucketErr) {
                    errors = errors.concat(bucketErr);
                }
            }
        }
    }

    if (!requiredProperty(style, 'layers', 'array', errors)) {
        style.layers.forEach(validateLayer);
    }

    if (!requiredProperty(style, 'styles', 'object', errors)) {
        for (var s in style.styles) {
            for (var b in style.styles[s]) {
                for (var rule in style.styles[s][b]) {
                    var styleErr = reference.validate.style(rule,
                        style.styles[s][b][rule],
                        style.styles[s][b].__line__,
                        style.constants);
                    if (styleErr) {
                        errors = errors.concat(styleErr);
                    }
                }
            }
        }
    }

    function validateLayer(layer) {
        if (typeof layer.id !== 'string') {
            errors.push({
                messages: 'layer "id" property must be a string',
                line: layer.__line__
            });
        }
        if (Array.isArray(layer.layers)) {
            layer.layers.forEach(validateLayer);
        } else if (layer.bucket && typeof layer.bucket !== 'string') {
            errors.push({
                messages: 'layer "bucket" property must be a string',
                line: layer.__line__
            });
        }
    }

    return errors;
}

function requiredProperty(_, name, type, errors) {
    if (typeof _[name] == 'undefined') {
        return errors.push({
            message: '"' + name + '" property required',
            line: _.__line__
        });
    } else if (type === 'array') {
        if (!Array.isArray(_[name])) {
            return errors.push({
                message: '"' + name +
                    '" property should be an array, but is an ' +
                    (typeof _[name]) + ' instead',
                line: _.__line__
            });
        }
    } else if (type && typeof _[name] !== type) {
        return errors.push({
            message: '"' + name +
                '" property should be ' + (type) +
                ', but is an ' + (typeof _[name]) + ' instead',
            line: _.__line__
        });
    }
}

function requiredEqual(_, name, val, errors) {
    if (!isEqual(_[name], val)) {
        return errors.push({
            message: '"' + name + '" property must equal <' +
                String(val) + '>, <' + String(_[name]) + '> found',
            line: _.__line__
        });
    }
}
