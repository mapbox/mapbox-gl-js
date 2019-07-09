// @flow

import murmur3 from 'murmurhash-js';

export default function deriveIntegerId(feature: VectorTileFeature, key: string) {
    const value = feature.properties[key];
    if (value === undefined) return;

    if (typeof value === 'number' && value % 1 === 0) {
        feature.id = value;
    } else {
        feature.id = murmur3(String(value));
    }
}
