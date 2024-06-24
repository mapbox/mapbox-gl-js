import assert from 'assert';

import type {StylePropertySpecification} from '../style-spec';
import type {
    FunctionSpecification,
    PropertyFunctionStop,
    ZoomAndPropertyFunctionStop,
    ExpressionSpecification,
} from '../types';

function convertLiteral(value: unknown) {
    return typeof value === 'object' ? ['literal', value] : value;
}

export default function convertFunction<T>(parameters: FunctionSpecification<T>, propertySpec: StylePropertySpecification): ExpressionSpecification {
    let stops = parameters.stops;
    if (!stops) {
        // identity function
        return convertIdentityFunction(parameters, propertySpec);
    }

    const zoomAndFeatureDependent = stops && typeof stops[0][0] === 'object';
    const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
    const zoomDependent = zoomAndFeatureDependent || !featureDependent;

    stops = stops.map((stop) => {
        if (!featureDependent && propertySpec.tokens && typeof stop[1] === 'string') {
            return [stop[0], convertTokenString(stop[1])];
        }
        return [stop[0], convertLiteral(stop[1])];
    }) as FunctionSpecification<T>['stops'];

    if (zoomAndFeatureDependent) {
        return convertZoomAndPropertyFunction(parameters, propertySpec, stops as Array<ZoomAndPropertyFunctionStop<T>>);
    } else if (zoomDependent) {
        return convertZoomFunction(parameters, propertySpec, stops as PropertyFunctionStop<T>[]);
    } else {
        return convertPropertyFunction(parameters, propertySpec, stops as PropertyFunctionStop<T>[]);
    }
}

function convertIdentityFunction<T>(parameters: FunctionSpecification<T>, propertySpec: StylePropertySpecification): ExpressionSpecification {
    const get: ExpressionSpecification = ['get', parameters.property];

    if (parameters.default === undefined) {
        // By default, expressions for string-valued properties get coerced. To preserve
        // legacy function semantics, insert an explicit assertion instead.
        return propertySpec.type === 'string' ? ['string', get] : get;
    } else if (propertySpec.type === 'enum') {
        return [
            'match',
            get,
            Object.keys(propertySpec.values),
            get,
            parameters.default
        ];
    } else {
        const expression: ExpressionSpecification = [propertySpec.type === 'color' ? 'to-color' : propertySpec.type, get, convertLiteral(parameters.default)];
        if (propertySpec.type === 'array') {
            expression.splice(1, 0, propertySpec.value, propertySpec.length || null);
        }
        return expression;
    }
}

function getInterpolateOperator<T>(parameters: FunctionSpecification<T>) {
    switch (parameters.colorSpace) {
    case 'hcl': return 'interpolate-hcl';
    case 'lab': return 'interpolate-lab';
    default: return 'interpolate';
    }
}

function convertZoomAndPropertyFunction<T>(
    parameters: FunctionSpecification<T>,
    propertySpec: StylePropertySpecification,
    stops: Array<ZoomAndPropertyFunctionStop<T>>,
): ExpressionSpecification {
    const featureFunctionParameters: Record<string, any> = {};
    const featureFunctionStops: Record<string, any> = {};
    const zoomStops = [];
    for (let s = 0; s < stops.length; s++) {
        const stop = stops[s];
        const zoom = stop[0].zoom;
        if (featureFunctionParameters[zoom] === undefined) {
            featureFunctionParameters[zoom] = {
                zoom,
                type: parameters.type,
                property: parameters.property,
                default: parameters.default,
            };
            featureFunctionStops[zoom] = [];
            zoomStops.push(zoom);
        }
        featureFunctionStops[zoom].push([stop[0].value, stop[1]]);
    }

    // the interpolation type for the zoom dimension of a zoom-and-property
    // function is determined directly from the style property specification
    // for which it's being used: linear for interpolatable properties, step
    // otherwise.
    const functionType = getFunctionType({} as FunctionSpecification<unknown>, propertySpec);
    if (functionType === 'exponential') {
        const expression: ExpressionSpecification = [getInterpolateOperator(parameters), ['linear'], ['zoom']];

        for (const z of zoomStops) {
            const output = convertPropertyFunction(featureFunctionParameters[z], propertySpec, featureFunctionStops[z]);
            appendStopPair(expression, z, output, false);
        }

        return expression;
    } else {
        const expression: ExpressionSpecification = ['step', ['zoom']];

        for (const z of zoomStops) {
            const output = convertPropertyFunction(featureFunctionParameters[z], propertySpec, featureFunctionStops[z]);
            appendStopPair(expression, z, output, true);
        }

        fixupDegenerateStepCurve(expression);

        return expression;
    }
}

function coalesce(a: unknown, b: unknown) {
    if (a !== undefined) return a;
    if (b !== undefined) return b;
}

function getFallback<T>(parameters: FunctionSpecification<T>, propertySpec: StylePropertySpecification) {
    const defaultValue = convertLiteral(coalesce(parameters.default, propertySpec.default));

    /*
     * Some fields with type: resolvedImage have an undefined default.
     * Because undefined is an invalid value for resolvedImage, set fallback to
     * an empty string instead of undefined to ensure output
     * passes validation.
     */
    if (defaultValue === undefined && propertySpec.type === 'resolvedImage') {
        return '';
    }
    return defaultValue;
}

function convertPropertyFunction<T>(
    parameters: FunctionSpecification<T>,
    propertySpec: StylePropertySpecification,
    stops: Array<PropertyFunctionStop<T>>,
): ExpressionSpecification {
    const type = getFunctionType(parameters, propertySpec);
    const get: ExpressionSpecification = ['get', parameters.property];
    if (type === 'categorical' && typeof stops[0][0] === 'boolean') {
        assert(parameters.stops.length > 0 && parameters.stops.length <= 2);
        const expression: ExpressionSpecification = ['case'];
        for (const stop of stops) {
            expression.push(['==', get, stop[0]], stop[1]);
        }

        expression.push(getFallback(parameters, propertySpec));
        return expression;
    } else if (type === 'categorical') {
        const expression: ExpressionSpecification = ['match', get];
        for (const stop of stops) {
            appendStopPair(expression, stop[0], stop[1], false);
        }
        expression.push(getFallback(parameters, propertySpec));
        return expression;
    } else if (type === 'interval') {
        const expression: ExpressionSpecification = ['step', ['number', get]];
        for (const stop of stops) {
            appendStopPair(expression, stop[0], stop[1], true);
        }
        fixupDegenerateStepCurve(expression);
        return parameters.default === undefined ? expression : [
            'case',
            ['==', ['typeof', get], 'number'],
            expression,
            convertLiteral(parameters.default)
        ];
    } else if (type === 'exponential') {
        const base = parameters.base !== undefined ? parameters.base : 1;
        const expression: ExpressionSpecification = [
            getInterpolateOperator(parameters),
            base === 1 ? ["linear"] : ["exponential", base],
            ["number", get]
        ];

        for (const stop of stops) {
            appendStopPair(expression, stop[0], stop[1], false);
        }
        return parameters.default === undefined ? expression : [
            'case',
            ['==', ['typeof', get], 'number'],
            expression,
            convertLiteral(parameters.default)
        ];
    } else {
        throw new Error(`Unknown property function type ${type}`);
    }
}

function convertZoomFunction<T>(parameters: FunctionSpecification<T>, propertySpec: StylePropertySpecification, stops: Array<PropertyFunctionStop<T>>, input: Array<string> = ['zoom']) {
    const type = getFunctionType(parameters, propertySpec);
    let expression;
    let isStep = false;
    if (type === 'interval') {
        expression = ['step', input];
        isStep = true;
    } else if (type === 'exponential') {
        const base = parameters.base !== undefined ? parameters.base : 1;
        expression = [getInterpolateOperator(parameters), base === 1 ? ["linear"] : ["exponential", base], input];

    } else {
        throw new Error(`Unknown zoom function type "${type}"`);
    }

    for (const stop of stops) {
        appendStopPair(expression, stop[0], stop[1], isStep);
    }

    fixupDegenerateStepCurve(expression);

    return expression;
}

function fixupDegenerateStepCurve(expression: ExpressionSpecification) {
    // degenerate step curve (i.e. a constant function): add a noop stop
    if (expression[0] === 'step' && expression.length === 3) {
        expression.push(0);
        expression.push(expression[3]);
    }
}

function appendStopPair(curve: ExpressionSpecification, input: unknown, output: unknown, isStep: boolean) {
    // Skip duplicate stop values. They were not validated for functions, but they are for expressions.
    // https://github.com/mapbox/mapbox-gl-js/issues/4107
    if (curve.length > 3 && input === curve[curve.length - 2]) {
        return;
    }
    // step curves don't get the first input value, as it is redundant.
    if (!(isStep && curve.length === 2)) {
        curve.push(input);
    }
    curve.push(output);
}

function getFunctionType<T>(parameters: FunctionSpecification<T>, propertySpec: StylePropertySpecification): string {
    if (parameters.type) {
        return parameters.type;
    } else {
        assert(propertySpec.expression);
        return (propertySpec.expression as any).interpolated ? 'exponential' : 'interval';
    }
}

// "String with {name} token" => ["concat", "String with ", ["get", "name"], " token"]
export function convertTokenString(s: string): string | ExpressionSpecification {
    const result: ExpressionSpecification = ['concat'];
    const re = /{([^{}]+)}/g;
    let pos = 0;
    for (let match = re.exec(s); match !== null; match = re.exec(s)) {
        const literal = s.slice(pos, re.lastIndex - match[0].length);
        pos = re.lastIndex;
        if (literal.length > 0) result.push(literal);
        result.push(['get', match[1]]);
    }

    if (result.length === 1) {
        return s;
    }

    if (pos < s.length) {
        result.push(s.slice(pos));
    } else if (result.length === 2) {
        return ['to-string', result[1]];
    }

    return result;
}

