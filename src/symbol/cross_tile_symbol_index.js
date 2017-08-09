const EXTENT = require('../data/extent');
const assert = require('assert');

// Round anchor positions to roughly 8 pixel grid
// Whatever rounding factor we choose, it will be possible
// to miss duplicate symbols right at the edge of grid lines.
// Ideally we should look up surrounding grid positions
const roundingFactor = 512 / EXTENT / 8;

class TileLayerIndex {
    constructor(coord, sourceMaxZoom, symbolInstances) {
        this.coord = coord;
        this.sourceMaxZoom = sourceMaxZoom;
        this.symbolInstances = {};

        for (const symbolInstance of symbolInstances) {
            const key = this.getKey(symbolInstance, coord, coord.z);
            this.symbolInstances[key] = symbolInstance;
            symbolInstance.isDuplicate = undefined;
            // If we don't pick up an opacity from our parent or child tiles
            // Reset so that symbols in cached tiles fade in the same
            // way as freshly loaded tiles
            symbolInstance.textOpacityState = {
                opacity: 0,
                targetOpacity: 0,
                time: 0
            };

            symbolInstance.iconOpacityState = {
                opacity: 0,
                targetOpacity: 0,
                time: 0
            };
        }
    }

    getKey(symbolInstance, coord, z) {
        const scale = Math.pow(2, Math.min(this.sourceMaxZoom, z) - Math.min(this.sourceMaxZoom, coord.z)) * roundingFactor;
        const anchor = symbolInstance.anchor;
        const x = Math.floor((coord.x * EXTENT + anchor.x) * scale);
        const y = Math.floor((coord.y * EXTENT + anchor.y) * scale);
        const key = `${x}/${y}/${symbolInstance.key}`;
        return key;
    }

    get(symbolInstance, coord) {
        const key = this.getKey(symbolInstance, coord, this.coord.z);
        return this.symbolInstances[key];
    }

}

class CrossTileSymbolLayerIndex {
    constructor() {
        this.indexes = {};
    }

    addTile(coord, sourceMaxZoom, symbolInstances) {

        let minZoom = 25;
        let maxZoom = 0;
        for (const zoom in this.indexes) {
            minZoom = Math.min(zoom, minZoom);
            maxZoom = Math.max(zoom, maxZoom);
        }

        const tileIndex = new TileLayerIndex(coord, sourceMaxZoom, symbolInstances);

        // make all higher-res child tiles block duplicate labels in this tile
        for (let z = maxZoom; z > coord.z; z--) {
            const zoomIndexes = this.indexes[z];
            for (const id in zoomIndexes) {
                const childIndex = zoomIndexes[id];
                if (!childIndex.coord.isChildOf(coord)) continue;
                this.blockLabels(childIndex, tileIndex);
            }
        }

        // make this tile block duplicate labels in lower-res parent tiles
        let parentCoord = coord;
        for (let z = coord.z - 1; z >= minZoom; z--) {
            parentCoord = parentCoord.parent(sourceMaxZoom);
            const parentIndex = this.indexes[z] && this.indexes[z][parentCoord.id];
            if (parentIndex) {
                this.blockLabels(tileIndex, parentIndex);
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

    blockLabels(childIndex, parentIndex) {
        for (const key in childIndex.symbolInstances) {
            const symbolInstance = childIndex.symbolInstances[key];

            // only non-duplicate labels can block other labels
            if (!symbolInstance.isDuplicate) {

                const parentSymbolInstance = parentIndex.get(symbolInstance, childIndex.coord);
                if (parentSymbolInstance !== undefined) {
                    // if the parent label was previously non-duplicate, make it duplicate because it's now blocked
                    if (!parentSymbolInstance.isDuplicate) {
                        parentSymbolInstance.isDuplicate = true;

                        // copy the parent's opacity to the child
                        assert(symbolInstance.isDuplicate !== false);
                        symbolInstance.isDuplicate = false;
                        symbolInstance.textOpacityState = parentSymbolInstance.textOpacityState;
                        symbolInstance.iconOpacityState = parentSymbolInstance.iconOpacityState;
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
                    // this label is now unblocked, copy it's opacity state
                    assert(parentSymbolInstance.isDuplicate !== false);
                    parentSymbolInstance.isDuplicate = false;
                    parentSymbolInstance.textOpacityState = symbolInstance.textOpacityState;
                    parentSymbolInstance.iconOpacityState = symbolInstance.iconOpacityState;

                    // mark it as duplicate now so that it doesn't unblock any other layers
                    symbolInstance.isDuplicate = true;
                }
            }
        }
    }
}

class CrossTileSymbolIndex {
    constructor() {
        this.layerIndexes = {};
    }

    addTileLayer(layerId, coord, sourceMaxZoom, symbolInstances) {
        let layerIndex = this.layerIndexes[layerId];
        if (layerIndex === undefined) {
            layerIndex = this.layerIndexes[layerId] = new CrossTileSymbolLayerIndex();
        }
        layerIndex.addTile(coord, sourceMaxZoom, symbolInstances);
    }

    removeTileLayer(layerId, coord, sourceMaxZoom) {
        const layerIndex = this.layerIndexes[layerId];
        if (layerIndex !== undefined) {
            layerIndex.removeTile(coord, sourceMaxZoom);
        }
    }
}

module.exports = CrossTileSymbolIndex;
