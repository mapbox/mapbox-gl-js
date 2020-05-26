// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import {RequestManager} from '../../src/util/mapbox';

const requestManager = new RequestManager();

export default function fetchStyle(value: string | StyleSpecification): Promise<StyleSpecification> {
    return typeof value === 'string' ?
        fetch(requestManager.normalizeStyleURL(value)).then(response => response.json()) :
        Promise.resolve(value);
}
