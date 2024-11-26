import EXTENT from '../style-spec/data/extent';

import type FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import type StyleLayer from '../style/style_layer';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type {OverscaledTileID} from './tile_id';
import type Style from '../style/style';
import type Tiled3dModelBucket from '../../3d-style/data/bucket/tiled_3d_model_bucket';
import type {Bucket} from '../data/bucket';
import type ModelStyleLayer from '../../3d-style/style/style_layer/model_style_layer';

class BuildingIndex {
    style: Style;
    layers: Array<{
        layer: StyleLayer;
        visible: boolean;
    }>;
    currentBuildingBuckets: Array<{
        bucket: Bucket | null | undefined;
        tileID: OverscaledTileID;
        verticalScale: number;
    }>;
    layersGotHidden: boolean; // when layer're hidden since the last frame, don't keep previous elevation, while loading tiles.

    constructor(style: Style) {
        this.style = style;
        this.layersGotHidden = false;
        this.layers = [];
    }

    processLayersChanged() {
        this.layers = [];
        const visible = false, visibilityChanged = false;
        for (const layerId in this.style._mergedLayers) {
            const layer = this.style._mergedLayers[layerId];
            if (layer.type === 'fill-extrusion') {
                // @ts-expect-error - TS2353 - Object literal may only specify known properties, and 'visibilityChanged' does not exist in type '{ layer: StyleLayer; visible: boolean; }'.
                this.layers.push({layer, visible, visibilityChanged});
            } else if (layer.type === 'model') {
                const source = this.style.getLayerSource(layer);
                if (source && source.type === 'batched-model') {
                    // @ts-expect-error - TS2353 - Object literal may only specify known properties, and 'visibilityChanged' does not exist in type '{ layer: StyleLayer; visible: boolean; }'.
                    this.layers.push({layer, visible, visibilityChanged});
                }
            }
        }
    }

    // Check if some of the building layers are disabled or with opacity evaluated to 0.
    onNewFrame(zoom: number) {
        this.layersGotHidden = false;
        for (const l of this.layers) {
            const layer = l.layer;
            let visible = false;
            if (layer.type === 'fill-extrusion') {

                visible = !layer.isHidden(zoom) && (layer as FillExtrusionStyleLayer).paint.get('fill-extrusion-opacity') > 0.0;
            } else if (layer.type === 'model') {

                visible = !layer.isHidden(zoom) && (layer as ModelStyleLayer).paint.get('model-opacity') > 0.0;
            }
            this.layersGotHidden = this.layersGotHidden || (!visible && l.visible);
            l.visible = visible;
        }
    }

    updateZOffset(symbolBucket: SymbolBucket, tileID: OverscaledTileID) {
        // prepare lookup from bucket to overlapping buckets of all building layers.
        this.currentBuildingBuckets = [];
        for (const l of this.layers) {
            const layer = l.layer;
            const sourceCache = this.style.getLayerSourceCache(layer);

            let verticalScale = 1;
            if (layer.type === 'fill-extrusion') {

                verticalScale = l.visible ? (layer as FillExtrusionStyleLayer).paint.get('fill-extrusion-vertical-scale') : 0;
            }

            let tile = sourceCache ? sourceCache.getTile(tileID) : null;

            if (!tile && sourceCache && tileID.canonical.z > sourceCache.getSource().minzoom) {
                let id = tileID.scaledTo(Math.min(sourceCache.getSource().maxzoom, tileID.overscaledZ - 1));
                while (id.overscaledZ >= sourceCache.getSource().minzoom) {
                    tile = sourceCache.getTile(id);
                    if (tile || id.overscaledZ === 0) break;
                    id = id.scaledTo(id.overscaledZ - 1);
                }
            }
            this.currentBuildingBuckets.push({bucket: tile ? tile.getBucket(layer) : null, tileID: tile ? tile.tileID : tileID, verticalScale});
        }

        symbolBucket.hasAnyZOffset = false;
        let dataChanged = false;
        for (let s = 0; s < symbolBucket.symbolInstances.length; s++) {
            const symbolInstance = symbolBucket.symbolInstances.get(s);
            const currentZOffset = symbolInstance.zOffset;
            const newZOffset = this._getHeightAtTileOffset(tileID, symbolInstance.tileAnchorX, symbolInstance.tileAnchorY);

            // When zooming over integer zooms, keep the elevation while loading building buckets.
            symbolInstance.zOffset = newZOffset !== Number.NEGATIVE_INFINITY ? newZOffset : currentZOffset;

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

    _mapCoordToOverlappingTile(
        tid: OverscaledTileID,
        x: number,
        y: number,
        targetTileID: OverscaledTileID,
    ): {
        tileX: number;
        tileY: number;
    } {
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
        let maxFillExtrusionHeight;
        // use FE data when landmark height is not available. Instead of assuming order, process
        // fill extrusions before landmarks
        for (let i = 0; i < this.layers.length; ++i) {
            const l = this.layers[i];
            const layer = l.layer;
            if (layer.type !== 'fill-extrusion') continue;
            const {bucket, tileID, verticalScale} = this.currentBuildingBuckets[i];
            if (!bucket) continue;

            const {tileX, tileY} = this._mapCoordToOverlappingTile(tid, x, y, tileID);

            const b: FillExtrusionBucket = (bucket as any);
            const heightData = b.getHeightAtTileCoord(tileX, tileY);
            if (!heightData || heightData.height === undefined) continue;
            if (heightData.hidden) { // read height, even if fill extrusion is hidden, until it is used for tiled 3D models.
                availableHeight = heightData.height;
                continue;
            }
            maxFillExtrusionHeight = Math.max(heightData.height * verticalScale, maxFillExtrusionHeight || 0);
        }
        if (maxFillExtrusionHeight !== undefined) {
            return maxFillExtrusionHeight;
        }

        for (let i = 0; i < this.layers.length; ++i) {
            const l = this.layers[i];
            const layer = l.layer;
            if (layer.type !== 'model' || !l.visible) continue;
            const {bucket, tileID} = this.currentBuildingBuckets[i];
            if (!bucket) continue;

            const {tileX, tileY} = this._mapCoordToOverlappingTile(tid, x, y, tileID);

            const b: Tiled3dModelBucket = (bucket as any);
            const heightData = b.getHeightAtTileCoord(tileX, tileY);
            if (!heightData || heightData.hidden) continue;
            if (heightData.height === undefined && availableHeight !== undefined) return Math.min(heightData.maxHeight, availableHeight) * heightData.verticalScale;
            return heightData.height ? heightData.height * heightData.verticalScale : Number.NEGATIVE_INFINITY;
        }
        // If we couldn't find a bucket, return Number.NEGATIVE_INFINITY. If a layer got hidden since previous frame, place symbols on ground.
        return this.layersGotHidden ? 0 : Number.NEGATIVE_INFINITY;
    }
}

export default BuildingIndex;
