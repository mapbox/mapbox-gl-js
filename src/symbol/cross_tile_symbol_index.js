// @flow

import EXTENT from '../style-spec/data/extent.js';

import {SymbolInstanceArray} from '../data/array_types.js';
import KDBush from 'kdbush';

import type Projection from '../geo/projection/projection.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import type SymbolBucket from '../data/bucket/symbol_bucket.js';
import type StyleLayer from '../style/style_layer.js';
import type Tile from '../source/tile.js';

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

class TileLayerIndex {
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
            const matchedIds = this.index.range(x - tolerance, y - tolerance, x + tolerance, y + tolerance);
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
    indexes: {[zoom: string | number]: {[tileId: string | number]: TileLayerIndex}};
    usedCrossTileIDs: {[zoom: string | number]: Set<number>};
    lng: number;

    constructor() {
        this.indexes = {};
        this.usedCrossTileIDs = {};
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
            for (const zoom in this.indexes) {
                const zoomIndexes = this.indexes[zoom];
                const newZoomIndex = {};
                for (const key in zoomIndexes) {
                    // change the tileID's wrap and add it to a new index
                    const index = zoomIndexes[key];
                    index.tileID = index.tileID.unwrapTo(index.tileID.wrap + wrapDelta);
                    newZoomIndex[index.tileID.key] = index;
                }
                this.indexes[zoom] = newZoomIndex;
            }
        }
        this.lng = lng;
    }

    addBucket(tileID: OverscaledTileID, bucket: SymbolBucket, crossTileIDs: CrossTileIDs): boolean {
        if (this.indexes[tileID.overscaledZ] &&
            this.indexes[tileID.overscaledZ][tileID.key]) {

            if (this.indexes[tileID.overscaledZ][tileID.key].bucketInstanceId ===
                bucket.bucketInstanceId) {
                return false;
            } else {
                // We're replacing this bucket with an updated version
                // Remove the old bucket's "used crossTileIDs" now so that
                // the new bucket can claim them.
                // The old index entries themselves stick around until
                // 'removeStaleBuckets' is called.
                this.removeBucketCrossTileIDs(tileID.overscaledZ,
                    this.indexes[tileID.overscaledZ][tileID.key]);
            }
        }

        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            symbolInstance.crossTileID = 0;
        }

        if (!this.usedCrossTileIDs[tileID.overscaledZ]) {
            this.usedCrossTileIDs[tileID.overscaledZ] = new Set();
        }
        const zoomCrossTileIDs = this.usedCrossTileIDs[tileID.overscaledZ];

        for (const zoom in this.indexes) {
            const zoomIndexes = this.indexes[zoom];
            if (Number(zoom) > tileID.overscaledZ) {
                for (const id in zoomIndexes) {
                    const childIndex = zoomIndexes[id];
                    if (childIndex.tileID.isChildOf(tileID)) {
                        childIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                    }
                }
            } else {
                const parentCoord = tileID.scaledTo(Number(zoom));
                const parentIndex = zoomIndexes[parentCoord.key];
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

        if (this.indexes[tileID.overscaledZ] === undefined) {
            this.indexes[tileID.overscaledZ] = {};
        }
        this.indexes[tileID.overscaledZ][tileID.key] = new TileLayerIndex(tileID, bucket.symbolInstances, bucket.bucketInstanceId);

        return true;
    }

    removeBucketCrossTileIDs(zoom: string | number, removedBucket: TileLayerIndex) {
        for (const crossTileID of removedBucket.crossTileIDs) {
            this.usedCrossTileIDs[zoom].delete(crossTileID);
        }
    }

    removeStaleBuckets(currentIDs: { [string | number]: boolean }): boolean {
        let tilesChanged = false;
        for (const z in this.indexes) {
            const zoomIndexes = this.indexes[z];
            for (const tileKey in zoomIndexes) {
                if (!currentIDs[zoomIndexes[tileKey].bucketInstanceId]) {
                    this.removeBucketCrossTileIDs(z, zoomIndexes[tileKey]);
                    delete zoomIndexes[tileKey];
                    tilesChanged = true;
                }
            }
        }
        return tilesChanged;
    }
}

class CrossTileSymbolIndex {
    layerIndexes: {[fqid: string]: CrossTileSymbolLayerIndex};
    crossTileIDs: CrossTileIDs;
    maxBucketInstanceId: number;
    bucketsInCurrentPlacement: {[_: number]: boolean};

    constructor() {
        this.layerIndexes = {};
        this.crossTileIDs = new CrossTileIDs();
        this.maxBucketInstanceId = 0;
        this.bucketsInCurrentPlacement = {};
    }

    addLayer(styleLayer: StyleLayer, tiles: Array<Tile>, lng: number, projection: Projection): boolean {
        let layerIndex = this.layerIndexes[styleLayer.fqid];
        if (layerIndex === undefined) {
            layerIndex = this.layerIndexes[styleLayer.fqid] = new CrossTileSymbolLayerIndex();
        }

        let symbolBucketsChanged = false;
        const currentBucketIDs = {};

        if (projection.name !== 'globe') {
            layerIndex.handleWrapJump(lng);
        }

        for (const tile of tiles) {
            const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
            if (!symbolBucket || styleLayer.fqid !== symbolBucket.layerIds[0])
                continue;

            if (!symbolBucket.bucketInstanceId) {
                symbolBucket.bucketInstanceId = ++this.maxBucketInstanceId;
            }

            if (layerIndex.addBucket(tile.tileID, symbolBucket, this.crossTileIDs)) {
                symbolBucketsChanged = true;
            }
            currentBucketIDs[symbolBucket.bucketInstanceId] = true;
        }

        if (layerIndex.removeStaleBuckets(currentBucketIDs)) {
            symbolBucketsChanged = true;
        }

        return symbolBucketsChanged;
    }

    pruneUnusedLayers(usedLayers: Array<string>) {
        const usedLayerMap = {};
        usedLayers.forEach((usedLayer) => {
            usedLayerMap[usedLayer] = true;
        });
        for (const layerId in this.layerIndexes) {
            if (!usedLayerMap[layerId]) {
                delete this.layerIndexes[layerId];
            }
        }
    }
}

export default CrossTileSymbolIndex;
