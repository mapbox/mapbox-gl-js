import type {PropertyExpressionSpecification, StylePropertySpecification} from '../style-spec';

type ExpressionParameter = PropertyExpressionSpecification['parameters'][number];

function expressionHasParameter(
    expression: PropertyExpressionSpecification | null | undefined,
    parameter: ExpressionParameter,
): boolean {
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

export function supportsLineProgressExpression(spec: StylePropertySpecification): boolean {
    return expressionHasParameter(spec.expression, 'line-progress');
}

export function supportsInterpolation(spec: StylePropertySpecification): boolean {
    return !!spec.expression && spec.expression.interpolated;
}
