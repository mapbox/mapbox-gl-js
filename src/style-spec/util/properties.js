// @flow

import type {StylePropertySpecification} from '../style-spec.js';

export function supportsPropertyExpression(spec: StylePropertySpecification): boolean {
    return spec['property-type'] === 'data-driven';
}

export function supportsZoomExpression(spec: StylePropertySpecification): boolean {
    return !!spec.expression && spec.expression.parameters.indexOf('zoom') > -1;
}

export function supportsInterpolation(spec: StylePropertySpecification): boolean {
    return !!spec.expression && spec.expression.interpolated;
}
