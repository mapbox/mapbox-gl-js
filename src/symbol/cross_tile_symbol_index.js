// @flow

const EXTENT = require('../data/extent');
const OpacityState = require('./opacity_state');
const assert = require('assert');

import type TileCoord from '../source/tile_coord';
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
    coord: TileCoord;
    sourceMaxZoom: number;
    symbolInstances: {[string]: Array<{
        instance: SymbolInstance,
        coordinates: {
            x: number,
            y: number
        }
    }>};

    constructor(coord: TileCoord, sourceMaxZoom: number, symbolInstances: Array<SymbolInstance>) {
        this.coord = coord;
        this.sourceMaxZoom = sourceMaxZoom;
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
                coordinates: this.getScaledCoordinates(symbolInstance, coord)
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
    getScaledCoordinates(symbolInstance: SymbolInstance, childTileCoord: TileCoord) {
        const zDifference = Math.min(this.sourceMaxZoom, childTileCoord.z) - Math.min(this.sourceMaxZoom, this.coord.z);
        const scale = roundingFactor / (1 << zDifference);
        const anchor = symbolInstance.anchor;
        return {
            x: Math.floor((childTileCoord.x * EXTENT + anchor.x) * scale),
            y: Math.floor((childTileCoord.y * EXTENT + anchor.y) * scale)
        };
    }

    getMatchingSymbol(childTileSymbol: SymbolInstance, childTileCoord: TileCoord) {
        if (!this.symbolInstances[childTileSymbol.key]) {
            return;
        }

        const childTileSymbolCoordinates =
            this.getScaledCoordinates(childTileSymbol, childTileCoord);

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

    addTile(coord: TileCoord, sourceMaxZoom: number, symbolInstances: Array<SymbolInstance>) {

        let minZoom = 25;
        let maxZoom = 0;
        for (const zoom in this.indexes) {
            minZoom = Math.min((zoom: any), minZoom);
            maxZoom = Math.max((zoom: any), maxZoom);
        }

        const tileIndex = new TileLayerIndex(coord, sourceMaxZoom, symbolInstances);

        // make all higher-res child tiles block duplicate labels in this tile
        for (let z = maxZoom; z > coord.z; z--) {
            const zoomIndexes = this.indexes[z];
            for (const id in zoomIndexes) {
                const childIndex = zoomIndexes[(id: any)];
                if (!childIndex.coord.isChildOf(coord, sourceMaxZoom)) continue;
                // Mark labels in this tile blocked, and don't copy opacity state
                // into this tile
                this.blockLabels(childIndex, tileIndex, false);
            }
        }

        const oldTileIndex = this.indexes[coord.z] && this.indexes[coord.z][coord.id];
        if (oldTileIndex) {
            // mark labels in the old version of the tile as blocked
            this.blockLabels(tileIndex, oldTileIndex, true);

            // remove old version of the tile
            this.removeTile(coord, sourceMaxZoom);
        }

        // make this tile block duplicate labels in lower-res parent tiles
        for (let z = coord.z - 1; z >= minZoom; z--) {
            const parentCoord = coord.scaledTo(z, sourceMaxZoom);
            const parentIndex = this.indexes[z] && this.indexes[z][parentCoord.id];
            if (parentIndex) {
                // Mark labels in the parent tile blocked, and copy opacity state
                // into this tile
                this.blockLabels(tileIndex, parentIndex, true);
            }
        }

        if (this.indexes[coord.z] === undefined) {
            this.indexes[coord.z] = {};
        }
        this.indexes[coord.z][coord.id] = tileIndex;
    }

    removeTile(coord: TileCoord, sourceMaxZoom: number) {
        const removedIndex = this.indexes[coord.z][coord.id];

        delete this.indexes[coord.z][coord.id];
        if (Object.keys(this.indexes[coord.z]).length === 0) {
            delete this.indexes[coord.z];
        }

        const minZoom = Math.min(25, ...(Object.keys(this.indexes): any));

        let parentCoord = coord;
        for (let z = coord.z - 1; z >= minZoom; z--) {
            parentCoord = parentCoord.parent(sourceMaxZoom);
            if (!parentCoord) break; // Flow doesn't know that z >= minZoom would prevent this
            const parentIndex = this.indexes[z] && this.indexes[z][parentCoord.id];
            if (parentIndex) this.unblockLabels(removedIndex, parentIndex);
        }
    }

    blockLabels(childIndex: TileLayerIndex, parentIndex: TileLayerIndex, copyParentOpacity: boolean) {
        childIndex.forEachSymbolInstance((symbolInstance) => {
            // only non-duplicate labels can block other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.getMatchingSymbol(symbolInstance, childIndex.coord);
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
        assert(childIndex.coord.z > parentIndex.coord.z);
        childIndex.forEachSymbolInstance((symbolInstance) => {
            // only non-duplicate labels were blocking other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.getMatchingSymbol(symbolInstance, childIndex.coord);
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

    addTileLayer(layerId: string, coord: TileCoord, sourceMaxZoom: number, symbolInstances: Array<SymbolInstance>) {
        let layerIndex = this.layerIndexes[layerId];
        if (layerIndex === undefined) {
            layerIndex = this.layerIndexes[layerId] = new CrossTileSymbolLayerIndex();
        }
        layerIndex.addTile(coord, sourceMaxZoom, symbolInstances);
    }

    removeTileLayer(layerId: string, coord: TileCoord, sourceMaxZoom: number) {
        const layerIndex = this.layerIndexes[layerId];
        if (layerIndex !== undefined) {
            layerIndex.removeTile(coord, sourceMaxZoom);
        }
    }
}

module.exports = CrossTileSymbolIndex;
