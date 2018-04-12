// @flow

export function isPropertyExpression(spec: Object): boolean {
    return spec['property-type'] === 'data-driven' || spec['property-type'] === 'cross-faded-data-driven';
}

export function isZoomExpression(spec: Object): boolean {
    return spec.expression && spec.expression.parameters.indexOf('zoom') > -1;
}

export function isInterpolated(spec: Object): boolean {
    return spec.expression && spec.expression.interpolated;
}
