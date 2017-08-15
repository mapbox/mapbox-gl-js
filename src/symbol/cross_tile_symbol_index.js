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

// Round anchor positions to roughly 8 pixel grid
// Whatever rounding factor we choose, it will be possible
// to miss duplicate symbols right at the edge of grid lines.
// Ideally we should look up surrounding grid positions
const roundingFactor = 512 / EXTENT / 8;

class TileLayerIndex {
    coord: TileCoord;
    sourceMaxZoom: number;
    symbolInstances: any;

    constructor(coord: TileCoord, sourceMaxZoom: number, symbolInstances: Array<SymbolInstance>) {
        this.coord = coord;
        this.sourceMaxZoom = sourceMaxZoom;
        this.symbolInstances = {};

        for (const symbolInstance of symbolInstances) {
            const key = this.getKey(symbolInstance, coord, coord.z);
            this.symbolInstances[key] = symbolInstance;
            symbolInstance.isDuplicate = false;
            // If we don't pick up an opacity from our parent or child tiles
            // Reset so that symbols in cached tiles fade in the same
            // way as freshly loaded tiles
            symbolInstance.textOpacityState = new OpacityState();
            symbolInstance.iconOpacityState = new OpacityState();
        }
    }

    getKey(symbolInstance: SymbolInstance, coord: TileCoord, z: number): string {
        const scale = Math.pow(2, Math.min(this.sourceMaxZoom, z) - Math.min(this.sourceMaxZoom, coord.z)) * roundingFactor;
        const anchor = symbolInstance.anchor;
        const x = Math.floor((coord.x * EXTENT + anchor.x) * scale);
        const y = Math.floor((coord.y * EXTENT + anchor.y) * scale);
        const key = `${x}/${y}/${symbolInstance.key}`;
        return key;
    }

    get(symbolInstance: SymbolInstance, coord: TileCoord) {
        const key = this.getKey(symbolInstance, coord, this.coord.z);
        return this.symbolInstances[key];
    }

}

class CrossTileSymbolLayerIndex {
    indexes: any;

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
                const childIndex = zoomIndexes[id];
                if (!childIndex.coord.isChildOf(coord, sourceMaxZoom)) continue;
                // Mark labels in this tile blocked, and don't copy opacity state
                // into this tile
                this.blockLabels(childIndex, tileIndex, false);
            }
        }

        // make this tile block duplicate labels in lower-res parent tiles
        let parentCoord = coord;
        for (let z = coord.z - 1; z >= minZoom; z--) {
            parentCoord = (parentCoord: any).parent(sourceMaxZoom);
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

    removeTile(coord, sourceMaxZoom) {
        const removedIndex = this.indexes[coord.z][coord.id];

        delete this.indexes[coord.z][coord.id];
        if (Object.keys(this.indexes[coord.z]).length === 0) {
            delete this.indexes[coord.z];
        }

        const minZoom = Object.keys(this.indexes).reduce((minZoom, zoom) => {
            return Math.min(minZoom, zoom);
        }, 25);

        let parentCoord = coord;
        for (let z = coord.z - 1; z >= minZoom; z--) {
            parentCoord = parentCoord.parent(sourceMaxZoom);
            const parentIndex = this.indexes[z] && this.indexes[z][parentCoord.id];
            if (parentIndex) this.unblockLabels(removedIndex, parentIndex);
        }
    }

    blockLabels(childIndex, parentIndex, copyParentOpacity) {
        for (const key in childIndex.symbolInstances) {
            const symbolInstance = childIndex.symbolInstances[key];

            // only non-duplicate labels can block other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.get(symbolInstance, childIndex.coord);
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
        }
    }

    unblockLabels(childIndex, parentIndex) {
        assert(childIndex.coord.z > parentIndex.coord.z);
        for (const key in childIndex.symbolInstances) {
            const symbolInstance = childIndex.symbolInstances[key];

            // only non-duplicate labels were blocking other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.get(symbolInstance, childIndex.coord);
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
        }
    }
}

class CrossTileSymbolIndex {
    layerIndexes: any;

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
