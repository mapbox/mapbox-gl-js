// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import {normalizeStyleURL} from '../../src/util/mapbox';

export default function fetchStyle(url: string): Promise<StyleSpecification> {
    return fetch(normalizeStyleURL(url))
        .then(response => response.json());
}
