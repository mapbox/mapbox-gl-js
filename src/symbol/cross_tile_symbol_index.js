// @flow

const EXTENT = require('../data/extent');
const OpacityState = require('./opacity_state');
const assert = require('assert');

import type {OverscaledTileID} from '../source/tile_id';
import type {SymbolInstance} from '../data/bucket/symbol_bucket';

/*
    The CrossTileSymbolIndex generally works on the assumption that
    a conceptual "unique symbol" can be identified by the text of
    the label combined with the anchor point. The goal is to keep
    symbol opacity states (determined by collision detection animations)
    consistent as we switch tile resolutions.

    Whenever we add a label, we look for duplicates at lower resolution,
    and if we find one, we copy its opacity state. If we find duplicates
    at higher resolution, we mark the added label as "blocked".

    When we remove a label that's currently showing, we look for duplicates
    at higher resolution, and if we find one we copy our opacity state
    to that label.

    The code mostly assumes that at any given time a "unique symbol" will have
    one "non-duplicate" entry, and that the rest of the entries in the
    index will all be marked as duplicate. This is not necessarily true:

    (1) The code searches child/parent hierarchies for duplicates, but it
        is possible for the source to contain symbols with anchors on tile
        boundaries, where the symbol does not stay in the same hierarchy
        at all zoom levels.
    (2) A high resolution tile may contain two symbols with the same label
        but different anchor points. At lower resolution, both of those
        symbols will appear to be the same.

    In the cases that violate our assumptions, copying opacities between
    zoom levels won't work as expected. However, the highest resolution
    tile should always "win", so that after some fade flicker the right
    label will show.
*/

// Round anchor positions to roughly 4 pixel grid
const roundingFactor = 512 / EXTENT / 2;

class TileLayerIndex {
    tileID: OverscaledTileID;
    symbolInstances: {[string]: Array<{
        instance: SymbolInstance,
        coordinates: {
            x: number,
            y: number
        }
    }>};

    constructor(tileID: OverscaledTileID, symbolInstances: Array<SymbolInstance>) {
        this.tileID = tileID;
        this.symbolInstances = {};

        for (const symbolInstance of symbolInstances) {
            const key = symbolInstance.key;
            if (!this.symbolInstances[key]) {
                this.symbolInstances[key] = [];
            }
            // This tile may have multiple symbol instances with the same key
            // Store each one along with its coordinates
            this.symbolInstances[key].push({
                instance: symbolInstance,
                coordinates: this.getScaledCoordinates(symbolInstance, tileID)
            });
            symbolInstance.isDuplicate = false;
            // If we don't pick up an opacity from our parent or child tiles
            // Reset so that symbols in cached tiles fade in the same
            // way as freshly loaded tiles
            symbolInstance.textOpacityState = new OpacityState();
            symbolInstance.iconOpacityState = new OpacityState();
        }
    }

    // Converts the coordinates of the input symbol instance into coordinates that be can compared
    // against other symbols in this index. Coordinates are:
    // (1) world-based (so after conversion the source tile is irrelevant)
    // (2) converted to the z-scale of this TileLayerIndex
    // (3) down-sampled by "roundingFactor" from tile coordinate precision in order to be
    //     more tolerant of small differences between tiles.
    getScaledCoordinates(symbolInstance: SymbolInstance, childTileID: OverscaledTileID) {
        const zDifference = childTileID.canonical.z - this.tileID.canonical.z;
        const scale = roundingFactor / (1 << zDifference);
        const anchor = symbolInstance.anchor;
        return {
            x: Math.floor((childTileID.canonical.x * EXTENT + anchor.x) * scale),
            y: Math.floor((childTileID.canonical.y * EXTENT + anchor.y) * scale)
        };
    }

    getMatchingSymbol(childTileSymbol: SymbolInstance, childTileID: OverscaledTileID) {
        if (!this.symbolInstances[childTileSymbol.key]) {
            return;
        }

        const childTileSymbolCoordinates =
            this.getScaledCoordinates(childTileSymbol, childTileID);

        for (const thisTileSymbol of this.symbolInstances[childTileSymbol.key]) {
            // Return any symbol with the same keys whose coordinates are within 1
            // grid unit. (with a 4px grid, this covers a 12px by 12px area)
            if (Math.abs(thisTileSymbol.coordinates.x - childTileSymbolCoordinates.x) <= 1 &&
                Math.abs(thisTileSymbol.coordinates.y - childTileSymbolCoordinates.y) <= 1) {
                return thisTileSymbol.instance;
            }
        }
    }

    forEachSymbolInstance(fn: (SymbolInstance) => void) {
        for (const key in this.symbolInstances) {
            const keyedSymbolInstances = this.symbolInstances[key];
            for (const symbolInstance of keyedSymbolInstances) {
                fn(symbolInstance.instance);
            }
        }
    }
}

class CrossTileSymbolLayerIndex {
    indexes: {[zoom: number]: {[tileId: number]: TileLayerIndex}};

    constructor() {
        this.indexes = {};
    }

    addTile(tileID: OverscaledTileID, symbolInstances: Array<SymbolInstance>) {

        let minZoom = 25;
        let maxZoom = 0;
        for (const zoom in this.indexes) {
            minZoom = Math.min((zoom: any), minZoom);
            maxZoom = Math.max((zoom: any), maxZoom);
        }

        const tileIndex = new TileLayerIndex(tileID, symbolInstances);

        // make all higher-res child tiles block duplicate labels in this tile
        for (let z = maxZoom; z > tileID.overscaledZ; z--) {
            const zoomIndexes = this.indexes[z];
            for (const id in zoomIndexes) {
                const childIndex = zoomIndexes[(id: any)];
                if (!childIndex.tileID.isChildOf(tileID)) continue;
                // Mark labels in this tile blocked, and don't copy opacity state
                // into this tile
                this.blockLabels(childIndex, tileIndex, false);
            }
        }

        const oldTileIndex = this.indexes[tileID.overscaledZ] && this.indexes[tileID.overscaledZ][tileID.key];
        if (oldTileIndex) {
            // mark labels in the old version of the tile as blocked
            this.blockLabels(tileIndex, oldTileIndex, true);

            // remove old version of the tile
            this.removeTile(tileID);
        }

        // make this tile block duplicate labels in lower-res parent tiles
        for (let z = tileID.overscaledZ - 1; z >= minZoom; z--) {
            const parentCoord = tileID.scaledTo(z);
            const parentIndex = this.indexes[z] && this.indexes[z][parentCoord.key];
            if (parentIndex) {
                // Mark labels in the parent tile blocked, and copy opacity state
                // into this tile
                this.blockLabels(tileIndex, parentIndex, true);
            }
        }

        if (this.indexes[tileID.overscaledZ] === undefined) {
            this.indexes[tileID.overscaledZ] = {};
        }
        this.indexes[tileID.overscaledZ][tileID.key] = tileIndex;
    }

    removeTile(tileID: OverscaledTileID) {
        const removedIndex = this.indexes[tileID.overscaledZ][tileID.key];

        delete this.indexes[tileID.overscaledZ][tileID.key];
        if (Object.keys(this.indexes[tileID.overscaledZ]).length === 0) {
            delete this.indexes[tileID.overscaledZ];
        }

        const minZoom = Math.min(25, ...(Object.keys(this.indexes): any));

        for (let z = tileID.overscaledZ - 1; z >= minZoom; z--) {
            const parentCoord = tileID.scaledTo(z);
            if (!parentCoord) break; // Flow doesn't know that z >= minZoom would prevent this
            const parentIndex = this.indexes[z] && this.indexes[z][parentCoord.key];
            if (parentIndex) this.unblockLabels(removedIndex, parentIndex);
        }
    }

    blockLabels(childIndex: TileLayerIndex, parentIndex: TileLayerIndex, copyParentOpacity: boolean) {
        childIndex.forEachSymbolInstance((symbolInstance) => {
            // only non-duplicate labels can block other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.getMatchingSymbol(symbolInstance, childIndex.tileID);
                if (parentSymbolInstance !== undefined) {
                    // if the parent label was previously non-duplicate, make it duplicate because it's now blocked
                    if (!parentSymbolInstance.isDuplicate) {
                        parentSymbolInstance.isDuplicate = true;

                        // If the child label is the one being added to the index,
                        // copy the parent's opacity to the child
                        if (copyParentOpacity) {
                            symbolInstance.textOpacityState = parentSymbolInstance.textOpacityState.clone();
                            symbolInstance.iconOpacityState = parentSymbolInstance.iconOpacityState.clone();
                        }
                    }
                }
            }
        });
    }

    unblockLabels(childIndex: TileLayerIndex, parentIndex: TileLayerIndex) {
        assert(childIndex.tileID.overscaledZ > parentIndex.tileID.overscaledZ);
        childIndex.forEachSymbolInstance((symbolInstance) => {
            // only non-duplicate labels were blocking other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.getMatchingSymbol(symbolInstance, childIndex.tileID);
                if (parentSymbolInstance !== undefined) {
                    // this label is now unblocked, copy its opacity state
                    parentSymbolInstance.isDuplicate = false;
                    parentSymbolInstance.textOpacityState = symbolInstance.textOpacityState.clone();
                    parentSymbolInstance.iconOpacityState = symbolInstance.iconOpacityState.clone();

                    // mark child as duplicate so that it doesn't unblock further tiles at lower res
                    // in the remaining calls to unblockLabels before it's fully removed
                    symbolInstance.isDuplicate = true;
                }
            }
        });
    }
}

class CrossTileSymbolIndex {
    layerIndexes: {[layerId: string]: CrossTileSymbolLayerIndex};

    constructor() {
        this.layerIndexes = {};
    }

    addTileLayer(layerId: string, tileID: OverscaledTileID, symbolInstances: Array<SymbolInstance>) {
        let layerIndex = this.layerIndexes[layerId];
        if (layerIndex === undefined) {
            layerIndex = this.layerIndexes[layerId] = new CrossTileSymbolLayerIndex();
        }
        layerIndex.addTile(tileID, symbolInstances);
    }

    removeTileLayer(layerId: string, tileID: OverscaledTileID) {
        const layerIndex = this.layerIndexes[layerId];
        if (layerIndex !== undefined) {
            layerIndex.removeTile(tileID);
        }
    }
}

module.exports = CrossTileSymbolIndex;
