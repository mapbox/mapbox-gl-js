import {PROPERTY_ELEVATION_ID} from './elevation_constants';

import type {ElevationTiledFeature} from '../../src/source/elevation_coverage_snapshot';
import type {BucketFeature} from '../../src/data/bucket';
import type {CanonicalTileID} from '../../src/source/tile_id';
import type {ElevationFeature} from './elevation_feature';

/**
 * Kept in its own file so core-path callers (currently `model_bucket`) don't drag the
 * ~500-line `elevation_feature.ts` (plus `elevation_feature_parser.ts`) into the shared
 * bundle just to call this helper. HD extensions route through the same lookup for
 * same-tile and cross-source elevation resolution.
 *
 * @private
 */
/// First index with matching id in the sorted registry, or -1. Callers scan the id run from there.
function firstRegistryIndexForId(registry: ElevationTiledFeature[], value: number): number {
    let lo = 0, hi = registry.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (registry[mid].feature.id < value) lo = mid + 1;
        else hi = mid - 1;
    }
    return (lo < registry.length && registry[lo].feature.id === value) ? lo : -1;
}

export function getElevationFeature(
    feature: BucketFeature,
    sameTileFeatures: ElevationFeature[] | undefined,
    registry?: ElevationTiledFeature[],
    featureCanonical?: CanonicalTileID,
): ElevationTiledFeature | undefined {
    if (!feature.properties) return undefined;

    const value = +feature.properties[PROPERTY_ELEVATION_ID];
    if (Number.isNaN(value)) return undefined;

    if (sameTileFeatures) {
        const hit = sameTileFeatures.find(f => f.id === value);
        if (hit && featureCanonical) {
            return {tileId: featureCanonical, feature: hit};
        }
    }

    if (!registry || registry.length === 0) return undefined;

    // Find the first matching entry, then scan the contiguous id run for an exact-tile match.
    const first = firstRegistryIndexForId(registry, value);
    if (first < 0) return undefined;

    if (featureCanonical) {
        for (let i = first; i < registry.length && registry[i].feature.id === value; i++) {
            if (registry[i].tileId.key === featureCanonical.key) return registry[i];
        }
    }
    return registry[first];
}

/// All registry parts whose tiles overlap `featureCanonical` (ancestors or descendants).
/// Caller merges them into one consumer-space curve via mergeElevationFeatures.
export function getOverlappingElevationParts(
    feature: BucketFeature,
    registry: ElevationTiledFeature[] | undefined,
    featureCanonical: CanonicalTileID,
): ElevationTiledFeature[] {
    if (!feature.properties || !registry || registry.length === 0) return [];
    const value = +feature.properties[PROPERTY_ELEVATION_ID];
    if (Number.isNaN(value)) return [];
    // Find the id range, then spatial-filter within it — no intermediate array.
    const first = firstRegistryIndexForId(registry, value);
    if (first < 0) return [];

    const result: ElevationTiledFeature[] = [];
    for (let i = first; i < registry.length && registry[i].feature.id === value; i++) {
        const e = registry[i];
        if (e.tileId.isChildOf(featureCanonical) ||
            featureCanonical.isChildOf(e.tileId) ||
            e.feature.constantHeight != null) {
            result.push(e);
        }
    }
    return result;
}
