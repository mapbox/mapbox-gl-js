// @flow

export function isPropertyFunction(spec: Object): boolean {
    const dataDrivenTypes = new Set(['data-driven', 'cross-faded-data-driven']);

    return spec.expression && dataDrivenTypes.has(spec.expression['property-type']);
}

export function isZoomFunction(spec: Object): boolean {
    return spec.expression && spec.expression.parameters.indexOf('zoom') > -1;
}

export function isInterpolated(spec: Object): boolean {
    return spec.expression && spec.expression.interpolated;
}
