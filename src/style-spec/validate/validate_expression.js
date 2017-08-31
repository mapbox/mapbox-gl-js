
const ValidationError = require('../error/validation_error');
const {findZoomCurve, getExpectedType} = require('../function');
const compile = require('../function/compile');
const Curve = require('../function/definitions/curve');
const unbundle = require('../util/unbundle_jsonlint');

module.exports = function validateExpression(options) {
    const expression = deepUnbundle(options.value.expression);
    const compiled = compile(expression, getExpectedType(options.valueSpec));

    const key = `${options.key}.expression`;

    if (compiled.result === 'success') {
        if (!options.disallowNestedZoom || compiled.isZoomConstant) {
            return [];
        }

        const curve = findZoomCurve(compiled.expression);
        if (curve instanceof Curve) {
            return [];
        } else if (curve) {
            return [new ValidationError(`${key}${curve.key}`, options.value, curve.error)];
        } else {
            return [new ValidationError(`${key}`, options.value, '"zoom" expression may only be used as input to a top-level "curve" expression.')];
        }
    }

    return compiled.errors.map((error) => {
        return new ValidationError(`${key}${error.key}`, options.value, error.message);
    });
};

function deepUnbundle (value) {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    }
    return unbundle(value);
}
