// @flow

import Tiled3dModelBucket from '../../3d-style/data/bucket/tiled_3d_model_bucket.js';
import FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket.js';
import Style from '../style/style.js';
import StyleLayer from '../style/style_layer.js';
import EXTENT from '../style-spec/data/extent.js';
import type {Bucket} from '../data/bucket.js';
import SymbolBucket from '../data/bucket/symbol_bucket.js';
import {OverscaledTileID} from './tile_id.js';
import FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer.js';

class BuildingIndex {
    style: Style;
    layers: Array<StyleLayer>;
    currentBuildingBuckets: Array<{bucket: ?Bucket, tileID: OverscaledTileID}>;

    constructor(style_: Style) {
        this.style = style_;
    }

    processLayersChanged() {
        this.layers = [];
        for (const layerId in this.style._layers) {
            const layer = this.style._layers[layerId];
            if (layer.type === 'fill-extrusion') {
                this.layers.push(layer);
            } else if (layer.type === 'model') {
                const source = this.style.getSource(layer.source);
                if (source && source.type === 'batched-model') {
                    this.layers.push(layer);
                }
            }
        }
    }

    updateZOffset(symbolBucket: SymbolBucket, tileID: OverscaledTileID) {
        // prepare lookup from bucket to overlapping buckets of all building layers.
        this.currentBuildingBuckets = [];
        for (let i = 0; i < this.layers.length; ++i) {
            const layer = this.layers[i];
            const source = this.style._getSourceCache(layer.source);

            let tile = source ? source.getTile(tileID) : null;

            if (!tile && source && tileID.canonical.z > source.getSource().minzoom) {
                let id = tileID.scaledTo(Math.min(source.getSource().maxzoom, tileID.overscaledZ - 1));
                while (id.overscaledZ >= source.getSource().minzoom) {
                    tile = source.getTile(id);
                    if (tile || id.overscaledZ === 0) break;
                    id = id.scaledTo(id.overscaledZ - 1);
                }
            }
            this.currentBuildingBuckets.push({bucket: tile ? tile.getBucket(layer) : null, tileID: tile ? tile.tileID : tileID});
        }

        symbolBucket.hasAnyZOffset = false;
        let dataChanged = false;
        for (let s = 0; s < symbolBucket.symbolInstances.length; s++) {
            const symbolInstance = symbolBucket.symbolInstances.get(s);
            const currentZOffset = symbolInstance.zOffset;
            symbolInstance.zOffset = this._getHeightAtTileOffset(tileID, symbolInstance.tileAnchorX, symbolInstance.tileAnchorY);
            if (!dataChanged && currentZOffset !== symbolInstance.zOffset) {
                dataChanged = true;
            }
            if (!symbolBucket.hasAnyZOffset && symbolInstance.zOffset !== 0) {
                symbolBucket.hasAnyZOffset = true;
            }
        }
        if (dataChanged) {
            symbolBucket.zOffsetBuffersNeedUpload = true;
            symbolBucket.zOffsetSortDirty = true;
        }
    }

    _mapCoordToOverlappingTile(tid: OverscaledTileID, x: number, y: number, targetTileID: OverscaledTileID): {tileX: number, tileY: number} {
        let tileX = x;
        let tileY = y;
        const tileID = targetTileID;
        if (tid.canonical.z !== tileID.canonical.z) {
            const id =  tileID.canonical;
            const zDiff = 1. / (1 << (tid.canonical.z - id.z));
            tileX = ((x + tid.canonical.x * EXTENT) * zDiff - id.x * EXTENT) | 0;
            tileY = ((y + tid.canonical.y * EXTENT) * zDiff - id.y * EXTENT) | 0;
        }
        return {tileX, tileY};
    }

    _getHeightAtTileOffset(tid: OverscaledTileID, x: number, y: number): number {
        let availableHeight;
        // use FE data when landmark height is not available. Instead of asuming order, process
        // fill extrusions before landmarks
        for (let i = 0; i < this.layers.length; ++i) {
            const layer = this.layers[i];
            if (layer.type !== 'fill-extrusion') continue;
            const {bucket, tileID} = this.currentBuildingBuckets[i];
            if (!bucket) continue;

            const {tileX, tileY} = this._mapCoordToOverlappingTile(tid, x, y, tileID);

            const b: FillExtrusionBucket = (bucket: any);
            const heightData = b.getHeightAtTileCoord(tileX, tileY);
            if (!heightData || heightData.height === undefined) continue;
            if (heightData.hidden) {
                availableHeight = heightData.height;
                continue;
            }
            const verticalScale = ((layer: any): FillExtrusionStyleLayer).paint.get('fill-extrusion-vertical-scale');
            return heightData.height * verticalScale;
        }

        for (let i = 0; i < this.layers.length; ++i) {
            const layer = this.layers[i];
            if (layer.type !== 'model') continue;
            const {bucket, tileID} = this.currentBuildingBuckets[i];
            if (!bucket) continue;

            const {tileX, tileY} = this._mapCoordToOverlappingTile(tid, x, y, tileID);

            const b: Tiled3dModelBucket = (bucket: any);
            const heightData = b.getHeightAtTileCoord(tileX, tileY);
            if (!heightData || heightData.hidden) continue;
            if (heightData.height === undefined && availableHeight !== undefined) return availableHeight * heightData.verticalScale;
            return (heightData.height || 0) * heightData.verticalScale;
        }
        return 0;
    }
}

export default BuildingIndex;
