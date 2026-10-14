import EXTENT from '../style-spec/data/extent';
import KDBush from 'kdbush';

import type Tile from '../source/tile';
import type Projection from '../geo/projection/projection';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import type {SymbolInstanceArray} from '../data/array_types';

/*
    The CrossTileSymbolIndex generally works on the assumption that
    a conceptual "unique symbol" can be identified by the text of
    the label combined with the anchor point. The goal is to assign
    these conceptual "unique symbols" a shared crossTileID that can be
    used by Placement to keep fading opacity states consistent and to
    deduplicate labels.

    The CrossTileSymbolIndex indexes all the current symbol instances and
    their crossTileIDs. When a symbol bucket gets added or updated, the
    index assigns a crossTileID to each of it's symbol instances by either
    matching it with an existing id or assigning a new one.
*/

// Round anchor positions to roughly 4 pixel grid
const roundingFactor = 512 / EXTENT / 2;

export class TileLayerIndex {
    tileID: OverscaledTileID;
    bucketInstanceId: number;
    index: KDBush;
    keys: Array<number>;
    crossTileIDs: Array<number>;

    constructor(tileID: OverscaledTileID, symbolInstances: SymbolInstanceArray, bucketInstanceId: number) {
        this.tileID = tileID;
        this.bucketInstanceId = bucketInstanceId;

        // create a spatial index for deduplicating symbol instances;
        // use a low nodeSize because we're optimizing for search performance, not indexing
        this.index = new KDBush(symbolInstances.length, 16, Int32Array);
        this.keys = [];
        this.crossTileIDs = [];
        const tx = tileID.canonical.x * EXTENT;
        const ty = tileID.canonical.y * EXTENT;

        for (let i = 0; i < symbolInstances.length; i++) {
            const {key, crossTileID, tileAnchorX, tileAnchorY} = symbolInstances.get(i);

            // Converts the coordinates of the input symbol instance into coordinates that be can compared
            // against other symbols in this index. Coordinates are:
            // (1) world-based (so after conversion the source tile is irrelevant)
            // (2) converted to the z-scale of this TileLayerIndex
            // (3) down-sampled by "roundingFactor" from tile coordinate precision in order to be
            //     more tolerant of small differences between tiles.
            const x = Math.floor((tx + tileAnchorX) * roundingFactor);
            const y = Math.floor((ty + tileAnchorY) * roundingFactor);

            this.index.add(x, y);
            this.keys.push(key);
            this.crossTileIDs.push(crossTileID);
        }
        this.index.finish();
    }

    findMatches(symbolInstances: SymbolInstanceArray, newTileID: OverscaledTileID, zoomCrossTileIDs: Set<number>) {
        const tolerance = this.tileID.canonical.z < newTileID.canonical.z ? 1 : Math.pow(2, this.tileID.canonical.z - newTileID.canonical.z);
        const scale = roundingFactor / Math.pow(2, newTileID.canonical.z - this.tileID.canonical.z);
        const tx = newTileID.canonical.x * EXTENT;
        const ty = newTileID.canonical.y * EXTENT;

        for (let i = 0; i < symbolInstances.length; i++) {
            const symbolInstance = symbolInstances.get(i);
            if (symbolInstance.crossTileID) {
                // already has a match, skip
                continue;
            }
            const {key, tileAnchorX, tileAnchorY} = symbolInstance;
            const x = Math.floor((tx + tileAnchorX) * scale);
            const y = Math.floor((ty + tileAnchorY) * scale);

            // Return any symbol with the same keys whose coordinates are within 1
            // grid unit. (with a 4px grid, this covers a 12px by 12px area)
            // Since KDBush.range does not guarantee that returned ids will be in order of insertion,
            // we need to sort them to keep a consistent crossTileID for symbol instances when a collision is found
            const matchedIds = this.index.range(x - tolerance, y - tolerance, x + tolerance, y + tolerance).sort((a, b) => a - b);
            for (const id of matchedIds) {
                const crossTileID = this.crossTileIDs[id];
                if (this.keys[id] === key && !zoomCrossTileIDs.has(crossTileID)) {
                    // Once we've marked ourselves duplicate against this parent symbol,
                    // don't let any other symbols at the same zoom level duplicate against
                    // the same parent (see issue #5993)
                    zoomCrossTileIDs.add(crossTileID);
                    symbolInstance.crossTileID = crossTileID;
                    break;
                }
            }
        }
    }
}

class CrossTileIDs {
    maxCrossTileID: number;
    constructor() {
        this.maxCrossTileID = 0;
    }
    generate(): number {
        return ++this.maxCrossTileID;
    }
}

class CrossTileSymbolLayerIndex {
    // Indexed by overscaled zoom; addBucket relies on visiting zooms in ascending order.
    indexes: Array<Map<number, TileLayerIndex> | undefined>;
    usedCrossTileIDs: Array<Set<number> | undefined>;
    lng: number;

    constructor() {
        this.indexes = [];
        this.usedCrossTileIDs = [];
        this.lng = 0;
    }

    /*
     * Sometimes when a user pans across the antimeridian the longitude value gets wrapped.
     * To prevent labels from flashing out and in we adjust the tileID values in the indexes
     * so that they match the new wrapped version of the map.
     */
    handleWrapJump(lng: number) {
        const wrapDelta = Math.round((lng - this.lng) / 360);
        if (wrapDelta !== 0) {
            for (let z = 0; z < this.indexes.length; z++) {
                const zoomIndexes = this.indexes[z];
                if (!zoomIndexes) continue;
                const newZoomIndex = new Map<number, TileLayerIndex>();
                for (const index of zoomIndexes.values()) {
                    // change the tileID's wrap and add it to a new index
                    index.tileID = index.tileID.unwrapTo(index.tileID.wrap + wrapDelta);
                    newZoomIndex.set(index.tileID.key, index);
                }
                this.indexes[z] = newZoomIndex;
            }
        }
        this.lng = lng;
    }

    addBucket(tileID: OverscaledTileID, bucket: SymbolBucket, crossTileIDs: CrossTileIDs): boolean {
        const tileZ = tileID.overscaledZ;
        const existing = this.indexes[tileZ] && this.indexes[tileZ].get(tileID.key);
        if (existing) {
            if (existing.bucketInstanceId === bucket.bucketInstanceId) {
                return false;
            } else {
                // We're replacing this bucket with an updated version
                // Remove the old bucket's "used crossTileIDs" now so that
                // the new bucket can claim them.
                // The old index entries themselves stick around until
                // 'removeStaleBuckets' is called.
                this.removeBucketCrossTileIDs(tileZ, existing);
            }
        }

        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            symbolInstance.crossTileID = 0;
        }

        let zoomCrossTileIDs = this.usedCrossTileIDs[tileZ];
        if (!zoomCrossTileIDs) zoomCrossTileIDs = this.usedCrossTileIDs[tileZ] = new Set();

        for (let z = 0; z < this.indexes.length; z++) {
            const zoomIndexes = this.indexes[z];
            if (!zoomIndexes) continue;
            if (z > tileZ) {
                for (const childIndex of zoomIndexes.values()) {
                    if (childIndex.tileID.isChildOf(tileID)) {
                        childIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                    }
                }
            } else {
                const parentIndex = zoomIndexes.get(tileID.scaledTo(z).key);
                if (parentIndex) {
                    parentIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                }
            }
        }

        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            if (!symbolInstance.crossTileID) {
                // symbol did not match any known symbol, assign a new id
                symbolInstance.crossTileID = crossTileIDs.generate();
                zoomCrossTileIDs.add(symbolInstance.crossTileID);
            }
        }

        let zoomIndexes = this.indexes[tileZ];
        if (!zoomIndexes) zoomIndexes = this.indexes[tileZ] = new Map<number, TileLayerIndex>();
        zoomIndexes.set(tileID.key, new TileLayerIndex(tileID, bucket.symbolInstances, bucket.bucketInstanceId));

        return true;
    }

    removeBucketCrossTileIDs(zoom: number, removedBucket: TileLayerIndex) {
        for (const crossTileID of removedBucket.crossTileIDs) {
            this.usedCrossTileIDs[zoom].delete(crossTileID);
        }
    }

    removeStaleBuckets(currentIDs: Set<number>): boolean {
        let tilesChanged = false;
        for (let z = 0; z < this.indexes.length; z++) {
            const zoomIndexes = this.indexes[z];
            if (!zoomIndexes) continue;
            for (const [tileKey, index] of zoomIndexes) {
                if (!currentIDs.has(index.bucketInstanceId)) {
                    this.removeBucketCrossTileIDs(z, index);
                    zoomIndexes.delete(tileKey);
                    tilesChanged = true;
                }
            }
        }
        return tilesChanged;
    }
}

class CrossTileSymbolIndex {
    layerIndexes: Map<string, CrossTileSymbolLayerIndex>;
    crossTileIDs: CrossTileIDs;

    constructor() {
        this.layerIndexes = new Map();
        this.crossTileIDs = new CrossTileIDs();
    }

    addLayer(
        styleLayer: TypedStyleLayer,
        tiles: Array<Tile>,
        lng: number,
        projection: Projection,
    ): boolean {
        let layerIndex = this.layerIndexes.get(styleLayer.fqid);
        if (layerIndex === undefined) {
            layerIndex = new CrossTileSymbolLayerIndex();
            this.layerIndexes.set(styleLayer.fqid, layerIndex);
        }

        let symbolBucketsChanged = false;
        const currentBucketIDs = new Set<number>();

        if (projection.name !== 'globe') {
            layerIndex.handleWrapJump(lng);
        }

        for (const tile of tiles) {
            const symbolBucket = (tile.getBucket(styleLayer) as SymbolBucket);
            if (!symbolBucket || styleLayer.fqid !== symbolBucket.layerIds[0])
                continue;

            if (layerIndex.addBucket(tile.tileID, symbolBucket, this.crossTileIDs)) {
                symbolBucketsChanged = true;
            }
            currentBucketIDs.add(symbolBucket.bucketInstanceId);
        }

        if (layerIndex.removeStaleBuckets(currentBucketIDs)) {
            symbolBucketsChanged = true;
        }

        return symbolBucketsChanged;
    }

    pruneUnusedLayers(usedLayers: Array<string>) {
        const usedLayerSet = new Set(usedLayers);
        for (const layerId of this.layerIndexes.keys()) {
            if (!usedLayerSet.has(layerId)) {
                this.layerIndexes.delete(layerId);
            }
        }
    }
}

export default CrossTileSymbolIndex;
