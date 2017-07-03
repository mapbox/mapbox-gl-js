const assert = require('assert');
const extend = require('../util/extend');

module.exports.function = convertFunction;
module.exports.value = convertValue;

function convertFunction(parameters, propertySpec) {
    let expression;

    parameters = extend({}, parameters);
    if (typeof parameters.default !== 'undefined') {
        parameters.default = convertValue(parameters.default, propertySpec);
    } else {
        parameters.default = convertValue(propertySpec.default, propertySpec);
    }

    if (parameters.stops) {
        const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
        const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
        const zoomDependent = zoomAndFeatureDependent || !featureDependent;

        parameters.stops = parameters.stops.map((stop) => {
            return [stop[0], convertValue(stop[1], propertySpec)];
        });

        if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
            throw new Error('Unimplemented');
        }

        if (zoomAndFeatureDependent) {
            expression = convertZoomAndPropertyFunction(parameters, propertySpec);
        } else if (zoomDependent) {
            expression = convertZoomFunction(parameters, propertySpec);
        } else {
            expression = convertPropertyFunction(parameters, propertySpec);
        }
    } else {
        // identity function
        expression = annotateValue(['get', parameters.property], propertySpec);
    }

    return ['coalesce', expression, parameters.default];
}

function annotateValue(value, spec) {
    if (spec.type === 'color') {
        return ['parse_color', ['string', value]];
    } else if (spec.type === 'array' && typeof spec.length === 'number') {
        return ['array', spec.value, spec.length, value];
    } else if (spec.type === 'array') {
        return ['array', spec.value, value];
    } else if (spec.type === 'enum') {
        return [
            'let',
            'property_value',
            ['string', value],
            'enum_values',
            ['literal', spec.values],
            [
                'case',
                ['has', ['property_value'], ['enum_values']],
                ['property_value'],
                null
            ]
        ];
    } else {
        return [spec.type, value];
        //const expectedTypeName = spec.type.slice(0, 1).toUpperCase() + spec.type.slice(1);
        //const checkType = ['==', expectedTypeName, ['typeof', value]];
        //return ['case', checkType, [spec.type, value], null];
    }
}

function convertValue(value, spec) {
    if (typeof value === 'undefined') return null;
    if (spec.type === 'color') {
        return ['parse_color', value];
    } else if (spec.type === 'array') {
        return ['literal', value];
    } else {
        return value;
    }
}

function convertZoomAndPropertyFunction(parameters, propertySpec) {
    const featureFunctions = {};
    const zoomStops = [];
    for (let s = 0; s < parameters.stops.length; s++) {
        const stop = parameters.stops[s];
        const zoom = stop[0].zoom;
        if (featureFunctions[zoom] === undefined) {
            featureFunctions[zoom] = {
                zoom: zoom,
                type: parameters.type,
                property: parameters.property,
                default: parameters.default,
                stops: []
            };
            zoomStops.push(zoom);
        }
        featureFunctions[zoom].stops.push([stop[0].value, stop[1]]);
    }

    // the interpolation type for the zoom dimension of a zoom-and-property
    // function is determined directly from the style property specification
    // for which it's being used: linear for interpolatable properties, step
    // otherwise.
    const functionType = getFunctionType({}, propertySpec);
    let interpolationType;
    if (functionType === 'exponential') {
        interpolationType = ['linear'];
    } else {
        interpolationType = ['step'];
    }
    const expression = ['curve', interpolationType, ['zoom']];

    for (const z of zoomStops) {
        expression.push(z, convertPropertyFunction(featureFunctions[z], propertySpec));
    }

    return expression;
}

function convertPropertyFunction(parameters, propertySpec) {
    const type = getFunctionType(parameters, propertySpec);

    let expression;
    if (type === 'categorical') {
        expression = ['match'];
    } else if (type === 'interval') {
        expression = ['curve', ['step']];
    } else if (type === 'exponential') {
        const base = parameters.base !== undefined ? parameters.base : 1;
        expression = ['curve', ['exponential', base]];
    } else {
        throw new Error(`Unknown property function type ${type}`);
    }

    const firstStopType = typeof parameters.stops[0][0];
    assert(
        firstStopType === 'string' ||
        firstStopType === 'number' ||
        firstStopType === 'boolean'
    );

    const expectedTypeName = firstStopType.slice(0, 1).toUpperCase() + firstStopType.slice(1);
    const checkType = ['==', expectedTypeName, ['typeof', ['get', parameters.property]]];
    expression.push([
        'case',
        checkType, [firstStopType, ['get', parameters.property]],
        null
    ]);

    for (const stop of parameters.stops) {
        expression.push(stop[0], stop[1]);
    }

    if (expression[0] === 'match') {
        expression.push(parameters.default);
    }

    return expression;
}

function convertZoomFunction(parameters, propertySpec) {
    const type = getFunctionType(parameters, propertySpec);
    let expression;
    if (type === 'interval') {
        expression = ['curve', ['step'], ['zoom']];
    } else if (type === 'exponential') {
        const base = parameters.base !== undefined ? parameters.base : 1;
        expression = ['curve', ['exponential', base], ['zoom']];
    } else {
        throw new Error(`Unknown zoom function type "${type}"`);
    }

    for (const stop of parameters.stops) {
        expression.push(stop[0], stop[1]);
    }

    return expression;
}

function getFunctionType (parameters, propertySpec) {
    if (parameters.type) {
        return parameters.type;
    } else if (propertySpec.function) {
        return propertySpec.function === 'interpolated' ? 'exponential' : 'interval';
    } else {
        return 'exponential';
    }
}
