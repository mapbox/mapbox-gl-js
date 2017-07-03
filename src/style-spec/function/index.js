
const assert = require('assert');
const compileExpression = require('./compile');
const convert = require('./convert');
const {ColorType, StringType, NumberType, ValueType, array} = require('./types');
const CurveExpression = require('./definitions/curve');
const CoalesceExpression = require('./definitions')['coalesce'];
const {LetExpression} = require('./expression');

function createFunction(parameters, propertySpec) {
    let expr;
    if (!isFunctionDefinition(parameters)) {
        expr = convert.value(parameters, propertySpec);
    } else if (parameters.expression) {
        expr = parameters.expression;
        if (typeof propertySpec.default !== 'undefined') {
            const specDefault = convert.value(propertySpec.default, propertySpec);
            expr = ['coalesce', expr, specDefault];
        }
    } else {
        expr = convert.function(parameters, propertySpec);
    }

    const expectedType = getExpectedType(propertySpec);
    const compiled = compileExpression(expr, expectedType);
    if (compiled.result === 'success') {
        const f = function (zoom, properties) {
            const val = compiled.function({zoom}, {properties});
            return val === null ? undefined : val;
        };
        f.isFeatureConstant = compiled.isFeatureConstant;
        f.isZoomConstant = compiled.isZoomConstant;
        if (!f.isZoomConstant) {
            // capture metadata from the curve definition that's needed for
            // our prepopulate-and-interpolate approach to paint properties
            // that are zoom-and-property dependent.
            let curve = compiled.expression;
            while (!(curve instanceof CurveExpression)) {
                if (curve instanceof CoalesceExpression) {
                    curve = curve.args[0];
                } else if (curve instanceof LetExpression) {
                    curve = curve.result;
                }
            }
            const curveArgs = [].concat(curve.args);
            const serialized = curve.serialize();
            const interpolation = serialized[1];

            f.zoomStops = [];
            for (let i = 2; i < curveArgs.length; i += 2) {
                f.zoomStops.push(curveArgs[i].value);
            }

            if (!f.isFeatureConstant) {
                const interpExpression = ['curve', interpolation, ['zoom']];
                for (let i = 0; i < f.zoomStops.length; i++) {
                    interpExpression.push(f.zoomStops[i], i);
                }
                const interpFunction = compileExpression(
                    ['coalesce', interpExpression, 0],
                    NumberType
                );
                assert(!interpFunction.errors);
                f.interpolationT = interpFunction.function;
            }
        }
        return f;
    } else {
        console.log(JSON.stringify(expr, null, 2));
        for (const err of compiled.errors) {
            console.log(`${err.key}: ${err.error}`);
        }
        throw new Error(compiled.errors.map(err => `${err.key}: ${err.error}`).join(', '));
    }
}

module.exports = createFunction;
module.exports.isFunctionDefinition = isFunctionDefinition;
module.exports.getExpectedType = getExpectedType;

function isFunctionDefinition(value) {
    return typeof value === 'object' &&
        (value.expression || value.stops || value.type === 'identity');
}

function getExpectedType(spec) {
    const types = {
        color: ColorType,
        string: StringType,
        number: NumberType,
        enum: StringType,
        image: StringType
    };

    if (spec.type === 'array') {
        return array(types[spec.value] || ValueType, spec.length);
    }

    return types[spec.type];
}

