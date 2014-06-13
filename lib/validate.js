'use strict';
var jsonlint = require('jsonlint-lines');
// var reference = require('./reference');
var reference = require('mapbox-gl-style-spec').latest;

// interpolate transitionable properties.
// bucket properties cannot be transitioned
for (var i in reference.style) {
    if (reference.style[i].transition) {
        reference.style['transition-' + i] = { type: 'transition' };
    }
}

module.exports = validate;
module.exports.v = v;

function v(key, obj, constants, ref, spec, errors) {
    var pass = true;

    // Resolve constants.
    if (typeof obj === 'string' && constants[obj]) obj = constants[obj];

    // Spec is for a JS native type.
    if (typeof spec === 'string') {
        if (typeof obj !== spec && spec !== '*') {
            errors.push(err(key + ' does not match required type ' + spec, obj.__line__));
            return false;
        } else {
            return true;
        }
    }

    // Spec is an enumeration of specific values that obj may match.
    if (Array.isArray(spec) && typeof spec[0] !== 'object') {
        if (spec.indexOf(obj) === -1) {
            errors.push(err(key + ' is not one of ' + spec, obj.__line__));
            return false;
        } else {
            return true;
        }
    }

    // Spec is an array of definitions that obj may match.
    if (Array.isArray(spec) && typeof spec[0] === 'object') {
        var sub = [];
        var valid = spec.some(function(s) {
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
                for (var i = 0; i < obj.length; i++) {
                    pass = v(key + '[' + i + ']', obj[i], constants, ref, ref[spec.value]||spec.value, errors) && pass;
                }
                return pass;
            } else {
                errors.push(err(key + ' must be an array', obj.__line__));
                return false;
            }
        // A straight up array.
        } else if (spec.type === 'array') {
            if (type === 'array') {
                return true;
            } else {
                errors.push(err(key + ' must be an array', obj.__line__));
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
    for (var k in obj) {
        var childkey = (key ? key + '.' : key) + k;
        var def = spec[k] || spec['*'] || undefined;
        if (!def) {
            errors.push(err('Unknown key at ' + childkey, obj.__line__));
            continue;
        }
        pass = v(childkey, obj[k], constants, ref, def, errors) && pass;
    }
    return pass;
}

function err(message, line) {
    var e = new Error(message);
    e.line = line;
    e.toJSON = function() { return { message: message, line: line }; };
    e.toString = function() { return message; };
    return e;
}

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

    style = jsonlint.parse(str.toString());

    validate.v('', style, style.constants||{}, reference, reference.$root, errors);

    return errors;
}

