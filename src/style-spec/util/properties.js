// @flow

import type {ExpressionSpecification, StylePropertySpecification} from '../style-spec.js';

function expressionHasParameter(expression: ?ExpressionSpecification, parameter: string): boolean {
    return !!expression && !!expression.parameters && expression.parameters.indexOf(parameter) > -1;
}

export function supportsPropertyExpression(spec: StylePropertySpecification): boolean {
    return spec['property-type'] === 'data-driven';
}

export function supportsLightExpression(spec: StylePropertySpecification): boolean {
    return expressionHasParameter(spec.expression, 'measure-light');
}

export function supportsZoomExpression(spec: StylePropertySpecification): boolean {
    return expressionHasParameter(spec.expression, 'zoom');
}

export function supportsInterpolation(spec: StylePropertySpecification): boolean {
    return !!spec.expression && spec.expression.interpolated;
}
