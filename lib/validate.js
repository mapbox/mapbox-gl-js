'use strict';
var jsonlint = require('jsonlint-lines');
var reference = require('./reference');
var parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = {};
module.exports.value = value;

['v2','v3'].forEach(function(version) {
    var ref = reference(version);
    // Create validator for version
    module.exports[version] = validator(ref);
    // Create validators for each container ('style', 'bucket', etc.)
    for (var container in ref) {
        if (typeof ref[container] !== 'object') continue;
        if (ref[container].type && typeof ref[container].type !== 'object') continue;
        module.exports[version][container] = validateContainer(ref, container);
    }
});

// Generates a validation function for a container object.
function validateContainer(ref, container) {
    return function (property, val, line) {
        var errors = [];
        var spec = ref[container][property];
        if (!spec) {
            errors.push({
                message: container + ' property unrecognized: ' + property,
                line: line
            });
        } else {
            value(property, val, {}, ref, spec, errors);
        }
        return errors;
    };
}

function validator(ref) {
    var validate = function(str) {
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

        value('', style, style.constants||{}, ref, ref.$root, errors);

        return errors;
    };
    return validate;
}

// Main recursive validation function. Tracks:
//
// - key: string representing location of validation in style tree. Used only
//   for more informative error reporting. Example: `styles.default.road`
// - val: current value from style being evaluated. May be anything from a
//   high level object that needs to be descended into deeper or a simple
//   scalar value.
// - constants: object of constants for the style to resolve constant values.
// - ref: full reference object. Used if any point in validation refers to
//   a type defined at the root-level of the reference object.
// - spec: current spec being evaluated. Tracks val.
// - errors: array of errors passed by reference.
//
// Returns true if the `val` passed (and any children recursed into) pass
// the validation defined by `spec`. Returns false if validation fails.
// Validation errors will be pushed onto the errors array.
function value(key, val, constants, ref, spec, errors) {
    var pass = true;

    // Resolve constants.
    if (typeof val === 'string' && constants[val] !== undefined) val = constants[val];

    // Spec specifies a non-native type (bucket, style, etc.)
    if (spec.type && ref[spec.type]) {
        return value(key, val, constants, ref, ref[spec.type], errors);
    // Spec specifies a type, but val must be an array of those (layers only atm).
    } else if (spec.type === 'array' && spec.value) {
        if (Array.isArray(val)) {
            if (spec.length && val.length !== spec.length) {
                errors.push({
                    message: key + ': array length ' + spec.length + ' expected, length ' + val.length + ' found',
                    line: val.__line__
                });
                return false;
            }
            for (var i = 0; i < val.length; i++) {
                var valspec = ref[spec.value]||spec.value;
                if (typeof valspec === 'string') {
                    pass = validateNative(key + '[' + i + ']', val[i], valspec, errors) && pass;
                } else {
                    pass = value(key + '[' + i + ']', val[i], constants, ref, valspec, errors) && pass;
                }
            }
            return pass;
        } else {
            errors.push({
                message: key + ': array expected, ' + typeof val + ' found',
                line: val.__line__
            });
            return false;
        }
    // Spec specifies an array of specs val may match.
    } else if (Array.isArray(spec)) {
        var sub = [];
        var valid = spec.some(function(s) {
            var spec = typeof s === 'string' ? (ref[s] || s) : s;
            if (typeof spec === 'string') {
                return validateNative(key, val, spec, sub);
            } else {
                return value(key, val, constants, ref, spec, sub);
            }
        });
        if (!valid) sub.forEach(function(err) { errors.push(err); });
        return valid;
    // Val is a function.
    } else if (spec.function && typeof val === 'object' && val.fn) {
        return value(key, val, constants, ref, ref.function, errors);
    // Val must be one of enumerated values.
    } else if (spec.type === 'enum') {
        return validateEnum(key, val, spec.values, errors);
    // Val must match a type.
    } else if (spec.type) {
        return validateNative(key, val, spec.type, errors);
    // No type defined: spec is a container. Val must be an object
    // and must have keys matching the container object definition.
    } else {
        for (var k in val) {
            var childkey = (key ? key + '.' : key) + k;
            var def = spec[k] || spec['*'] || undefined;
            if (!def) {
                errors.push({
                    message: spec.__name__ + ' property unrecognized: ' + k,
                    line: val.__line__
                });
                pass = false;
                continue;
            }
            pass = value(childkey, val[k], constants, ref, def, errors) && pass;
        }
        for (var l in spec) {
            if (spec[l].required && spec[l]['default'] === undefined && val[l] === undefined) {
                errors.push({
                    message: spec.__name__ + ' property ' + l + ' required',
                    line: val.__line__
                });
                pass = false;
            }
        }
        return pass;
    }
}

function validateNative(key, val, spec, errors) {
    if (spec === '*') return true;

    var type = Array.isArray(val) ? 'array' : typeof val;

    if (spec === 'color') {
        if (type === 'array') {
            if (val.length > 4 || val.length < 3) {
                errors.push({
                    message: key + ': ' + spec + ' expected, ' + val + ' found',
                    line: val.__line__
                });
                return false;
            }
            return true;
        } else if (type !== 'string') {
            errors.push({
                message: key + ': ' + spec + ' expected, ' + type + ' found',
                line: val.__line__
            });
            return false;
        } else if (parseCSSColor(val) === null) {
            errors.push({
                message: key + ': ' + spec + ' expected, ' + val + ' found',
                line: val.__line__
            });
            return false;
        } else {
            return true;
        }
    }

    if (type !== spec) {
        errors.push({
            message: key + ': ' + spec + ' expected, ' + (typeof val) + ' found',
            line: val.__line__
        });
        return false;
    } else {
        return true;
    }
}

function validateEnum(key, val, spec, errors) {
    if (spec.indexOf(val) === -1) {
        errors.push({
            message: key + ': expected one of [' + spec.join(', ') + '], ' + val + ' found',
            line: val.__line__
        });
        return false;
    } else {
        return true;
    }
}

