import {BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION} from "../data/bucket/building_bucket";

import type BuildingBucket from "../data/bucket/building_bucket";
import type SourceCache from "../../src/source/source_cache";
import type {CanonicalTileID} from "../../src/source/tile_id";
import type BuildingStyleLayer from "../style/style_layer/building_style_layer";

export class BuildingTileBorderManager {
    private visibleTiles: Array<number> = [];

    public updateBorders(source: SourceCache, layer: BuildingStyleLayer) {
        const visibleTiles: Array<number> = [];
        const buckets: Array<{bucket: BuildingBucket, tileID: CanonicalTileID}> = [];

        const coords = source._getRenderableCoordinates(false, true);
        for (const coord of coords) {
            const tile = source.getTile(coord);
            if (!tile.hasData()) {
                continue;
            }
            const bucket = tile.getBucket(layer) as BuildingBucket;
            if (!bucket) {
                continue;
            }
            if (bucket.isEmpty()) {
                continue;
            }
            visibleTiles.push(coord.key);
            buckets.push({bucket, tileID: coord.canonical});
        }

        // Check if the visible tiles have changed
        let bordersChanged = visibleTiles.length !== this.visibleTiles.length;
        if (!bordersChanged) {
            // Sort the visible tiles to ensure consistent ordering
            visibleTiles.sort();
            for (let i = 0; i < visibleTiles.length; i++) {
                if (visibleTiles[i] !== this.visibleTiles[i]) {
                    bordersChanged = true;
                    break;
                }
            }
        }

        if (!bordersChanged) {
            return;
        }

        const uniqueFeatureIDInstances = new Set<number>();
        this.visibleTiles = visibleTiles;

        // Sort buckets by tile id to ensure consistent results
        // Ensure same sorting criteria is used on gl-native side to ensure parity
        buckets.sort((lhs, rhs) => {
            // Strict weak ordering
            return (lhs.tileID.z - rhs.tileID.z) || (lhs.tileID.x - rhs.tileID.x) || (lhs.tileID.y - rhs.tileID.y);
        });

        for (const bucketAndTileID of buckets) {
            const footprintsToShowIndices = new Array<number>();
            const footprintsToHideIndices = new Array<number>();

            const bucket = bucketAndTileID.bucket;

            for (const featureOnBorder of bucket.featuresOnBorder) {
                if (!uniqueFeatureIDInstances.has(featureOnBorder.featureId)) {
                    uniqueFeatureIDInstances.add(featureOnBorder.featureId);
                    footprintsToShowIndices.push(featureOnBorder.footprintIndex);
                } else {
                    footprintsToHideIndices.push(featureOnBorder.footprintIndex);
                }
            }

            // Clear BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION flag of footprints which should be shown
            bucket.updateFootprintHiddenFlags(footprintsToShowIndices, BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION, false);
            // Set BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION flag of footprints which should be hidden
            bucket.updateFootprintHiddenFlags(footprintsToHideIndices, BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION, true);
        }
    }
}
