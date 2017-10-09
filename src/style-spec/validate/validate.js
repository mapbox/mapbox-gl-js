
const ValidationError = require('../error/validation_error');
const getType = require('../util/get_type');
const extend = require('../util/extend');
const unbundle = require('../util/unbundle_jsonlint');
const {isExpression} = require('../expression');
const {isFunction} = require('../function');

// Main recursive validation function. Tracks:
//
// - key: string representing location of validation in style tree. Used only
//   for more informative error reporting.
// - value: current value from style being evaluated. May be anything from a
//   high level object that needs to be descended into deeper or a simple
//   scalar value.
// - valueSpec: current spec being evaluated. Tracks value.

module.exports = function validate(options) {

    const validateFunction = require('./validate_function');
    const validateExpression = require('./validate_expression');
    const validateObject = require('./validate_object');
    const VALIDATORS = {
        '*': function() {
            return [];
        },
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
        'light': require('./validate_light'),
        'string': require('./validate_string')
    };

    const value = options.value;
    const valueSpec = options.valueSpec;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (getType(value) === 'string' && value[0] === '@') {
        if (styleSpec.$version > 7) {
            return [new ValidationError(key, value, 'constants have been deprecated as of v8')];
        }
        if (!(value in style.constants)) {
            return [new ValidationError(key, value, 'constant "%s" not found', value)];
        }
        options = extend({}, options, { value: style.constants[value] });
    }

    if (valueSpec.function && isFunction(unbundle(value))) {
        return validateFunction(options);

    } else if (valueSpec.function && isExpression(unbundle.deep(value))) {
        return validateExpression(options);

    } else if (valueSpec.type && VALIDATORS[valueSpec.type]) {
        return VALIDATORS[valueSpec.type](options);

    } else {
        return validateObject(extend({}, options, {
            valueSpec: valueSpec.type ? styleSpec[valueSpec.type] : valueSpec
        }));
    }
};
