import {ElevationFeatures, type ElevationFeature} from './elevation_feature';
import {HD_ELEVATION_SOURCE_LAYER} from './elevation_constants';

import type {VectorTile} from '@mapbox/vector-tile';
import type {CanonicalTileID} from '../../src/source/tile_id';

/**
 * Parses the HD elevation source layer (if present) into an array of elevation features.
 * Returns `undefined` when the tile has no HD elevation source layer, letting callers
 * short-circuit without touching `PopulateParameters.elevationFeatures`.
 *
 * @private
 */
export function parseElevationFeatures(data: VectorTile, canonical: CanonicalTileID): ElevationFeature[] | undefined {
    if (!Object.hasOwn(data.layers, HD_ELEVATION_SOURCE_LAYER)) {
        return undefined;
    }
    return ElevationFeatures.parseFrom(data.layers[HD_ELEVATION_SOURCE_LAYER]!, canonical);
}
