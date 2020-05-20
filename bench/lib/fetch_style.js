// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import {normalizeStyleURL} from '../../src/util/mapbox';

export default function fetchStyle(value: string | StyleSpecification): Promise<StyleSpecification> {
    return typeof value === 'string' ?
        fetch(normalizeStyleURL(value)).then(response => response.json()) :
        Promise.resolve(value);
}
