'use strict';
var jsonlint = require('jsonlint-lines');
var reference = require('./reference')('latest');
var parseCSSColor = require('csscolorparser').parseCSSColor;

module.exports = validate;
module.exports.value = value;

// Create validators for each container ('style', 'bucket', etc.)
for (var container in reference) {
    if (typeof reference[container] !== 'object') continue;
    if (reference[container].type) continue;
    module.exports[container] = validateContainer(container);
}

// Generates a validation function for a container object.
function validateContainer(container) {
    return function (property, val, line) {
        var errors = [];
        var spec = reference[container][property];
        if (!spec) {
            errors.push({
                message: container + ' property unrecognized: ' + property,
                line: line
            });
        } else {
            value(property, val, {}, reference, spec, errors);
        }
        return errors;
    };
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

    validate.value('', style, style.constants||{}, reference, reference.$root, errors);

    return errors;
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

    // End recursion: validate a native value.
    if (typeof spec === 'string') return validateNative(key, val, spec, errors);

    // End recursion: validate an enum value.
    if (Array.isArray(spec) && typeof spec[0] !== 'object') return validateEnum(key, val, spec, errors);

    // Spec specifies a non-native type (bucket, style, etc.)
    if (spec.type && ref[spec.type]) {
        return value(key, val, constants, ref, ref[spec.type], errors);
    // Spec specifies a type, but val must be an array of those (layers only atm).
    } else if (spec.type === 'array' && spec.value) {
        if (Array.isArray(val)) {
            for (var i = 0; i < val.length; i++) {
                pass = value(key + '[' + i + ']', val[i], constants, ref, ref[spec.value]||spec.value, errors) && pass;
            }
            return pass;
        } else {
            errors.push({
                error: key + ' must be an array',
                line: val.__line__
            });
            return false;
        }
    // Spec specifies an array of specs val may match.
    } else if (Array.isArray(spec) && typeof spec[0] === 'object') {
        var sub = [];
        var valid = spec.some(function(s) {
            return value(key, val, constants, ref, s, sub);
        });
        if (!valid) sub.forEach(function(err) { errors.push(err); });
        return valid;
    // Val is a function.
    } else if (spec.function && typeof val === 'object' && val.fn) {
        return value(key, val, constants, ref, ref.style_fn, errors);
    // Val must match a type.
    } else if (spec.type) {
        return value(key, val, constants, ref, spec.type, errors);
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
                continue;
            }
            pass = value(childkey, val[k], constants, ref, def, errors) && pass;
        }
        for (var l in spec) {
            if (spec[l].required && spec[l]['default-value'] === undefined && val[l] === undefined) {
                errors.push({
                    message: spec.__name__ + ' property ' + l + ' required',
                    line: val.__line__
                });
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

