'use strict';

var ValidationError = require('../validation_error');
var getType = require('../get_type');
var validate = require('./validate');
var validateObject = require('./validate_object');
var validateArray = require('./validate_array');

module.exports = function validateFunction(key, val, spec, context) {
    var errors = [];

    errors = errors.concat(validateObject(key, val, context.reference.function, context, {
        stops: function (key, val, arraySpec) {
            var errors = [];
            var lastStop = -Infinity;
            errors = errors.concat(validateArray(key, val, arraySpec, context, validateStop));

            if (getType(val) === 'array' && val.length === 0) {
                errors.push(new ValidationError(key, val, 'array must have at least one stop'));
            }

            return errors;

            function validateStop(key, val) {
                var errors = [];

                if (getType(val) !== 'array') {
                    return new ValidationError(key, val, 'array expected, %s found', getType(val));
                }

                if (val.length !== 2) {
                    return new ValidationError(key, val, 'array length %d expected, length %d found', 2, val.length);
                }

                errors = errors.concat(validate(key + '[0]', val[0], {type: 'number'}, context));
                errors = errors.concat(validate(key + '[1]', val[1], spec, context));

                if (getType(val[0]) === 'number') {
                    if (spec.function === 'piecewise-constant' && val[0] % 1 !== 0) {
                        errors = errors.concat(new ValidationError(key + '[0]', val[0], 'zoom level for piecewise-constant functions must be an integer'));
                    }

                    if (val[0] < lastStop) {
                        errors.push(new ValidationError(key + '[0]', val[0], 'array stops must appear in ascending order'));
                    }

                    lastStop = val[0];
                }

                return errors;
            }
        }
    }));

    return errors;
};
