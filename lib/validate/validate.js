'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');

// Main recursive validation function. Tracks:
//
// - key: string representing location of validation in style tree. Used only
//   for more informative error reporting.
// - val: current value from style being evaluated. May be anything from a
//   high level object that needs to be descended into deeper or a simple
//   scalar value.
// - spec: current spec being evaluated. Tracks val.

// TODO swap order of spec and context in args
module.exports = function validate(key, val, spec, context) {

    var validateFunction = require('./validate_function');
    var validateObject = require('./validate_object');
    var VALIDATORS = {
        '*': function() {},
        'array': require('./validate_array'),
        'boolean': require('./validate_boolean'),
        'number': require('./validate_number'),
        'color': require('./validate_color'),
        'constants': require('./validate_constants'),
        'enum': require('./validate_enum'),
        'filter': require('./validate_filter'),
        'function': require('./validate_function'),
        'layer': require('./validate_layer'),
        'object': require('./validate_object'),
        'source': require('./validate_source'),
        'string': require('./validate_string')
    };

    if (getType(val) === 'string' && val[0] === '@') {
        if (context.reference.$version > 7) {
            return new ValidationError(key, val, 'constants have been deprecated as of v8');
        }
        if (!(val in context.constants)) {
            return new ValidationError(key, val, 'constant "%s" not found', val);
        }
        val = context.constants[val];
    }

    var type = getType(val);

    if (spec.function && type === 'object') {
        return validateFunction(key, val, spec, context);

    } else if (spec.type && VALIDATORS[spec.type]) {
        return VALIDATORS[spec.type](key, val, spec, context);

    } else {
        if (spec.type) {
            spec = context.reference[spec.type];
        }
        return validateObject(key, val, spec, context);
    }
};
