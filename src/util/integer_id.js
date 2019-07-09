// @flow

import murmur3 from 'murmurhash-js';

export function setIntegerId(feature: VectorTileFeature, key: string) {
    const value = feature.properties[key];
    if (value !== undefined) {
        feature.id = getIntegerId(value);
    }
}

export function getIntegerId(value: mixed) {
    const numValue = +value;
    if (!isNaN(numValue) && numValue % 1 === 0) {
        return numValue;
    }
    return murmur3(String(value));
}
