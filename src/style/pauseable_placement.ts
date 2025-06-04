import browser from '../util/browser';
import {Placement} from '../symbol/placement';
import {PerformanceUtils} from '../util/performance';
import {makeFQID} from '../util/fqid';

import type Transform from '../geo/transform';
import type {TypedStyleLayer} from './style_layer/typed_style_layer';
import type SymbolStyleLayer from './style_layer/symbol_style_layer';
import type Tile from '../source/tile';
import type {BucketPart} from '../symbol/placement';
import type {FogState} from './fog_helpers';
import type BuildingIndex from '../source/building_index';

class LayerPlacement {
    _sortAcrossTiles: boolean;
    _currentTileIndex: number;
    _currentPartIndex: number;
    _seenCrossTileIDs: Set<number>;
    _bucketParts: Array<BucketPart>;

    constructor(styleLayer: SymbolStyleLayer) {
        this._sortAcrossTiles = styleLayer.layout.get('symbol-z-order') !== 'viewport-y' &&
            styleLayer.layout.get('symbol-sort-key').constantOr(1) !== undefined;

        this._currentTileIndex = 0;
        this._currentPartIndex = 0;
        this._seenCrossTileIDs = new Set();
        this._bucketParts = [];
    }

    continuePlacement(
        tiles: Array<Tile>,
        placement: Placement,
        showCollisionBoxes: boolean,
        styleLayer: TypedStyleLayer,
        shouldPausePlacement: () => boolean,
        scaleFactor: number
    ): boolean {
        const bucketParts = this._bucketParts;

        while (this._currentTileIndex < tiles.length) {
            const tile = tiles[this._currentTileIndex];
            placement.getBucketParts(bucketParts, styleLayer, tile, this._sortAcrossTiles, scaleFactor);

            this._currentTileIndex++;
            if (shouldPausePlacement()) {
                return true;
            }
        }

        if (this._sortAcrossTiles) {
            this._sortAcrossTiles = false;
            bucketParts.sort((a, b) => (a.sortKey) - (b.sortKey));
        }

        while (this._currentPartIndex < bucketParts.length) {
            const bucketPart = bucketParts[this._currentPartIndex];
            placement.placeLayerBucketPart(bucketPart, this._seenCrossTileIDs, showCollisionBoxes, bucketPart.symbolInstanceStart === 0, scaleFactor);
            this._currentPartIndex++;
            if (shouldPausePlacement()) {
                return true;
            }
        }
        return false;
    }
}

class PauseablePlacement {
    placement: Placement;
    _done: boolean;
    _currentPlacementIndex: number;
    _forceFullPlacement: boolean;
    _showCollisionBoxes: boolean;
    _inProgressLayer: LayerPlacement | null | undefined;

    constructor(transform: Transform, order: Array<string>,
                forceFullPlacement: boolean,
                showCollisionBoxes: boolean,
                fadeDuration: number,
                crossSourceCollisions: boolean,
                prevPlacement?: Placement,
                fogState?: FogState | null,
                buildingIndex?: BuildingIndex | null
    ) {
        this.placement = new Placement(transform, fadeDuration, crossSourceCollisions, prevPlacement, fogState, buildingIndex);
        this._currentPlacementIndex = order.length - 1;
        this._forceFullPlacement = forceFullPlacement;
        this._showCollisionBoxes = showCollisionBoxes;
        this._done = false;
    }

    isDone(): boolean {
        return this._done;
    }

    continuePlacement(order: Array<string>, layers: Record<string, TypedStyleLayer>, layerTiles: Record<string, Array<Tile>>, layerTilesInYOrder: Record<string, Array<Tile>>, scaleFactor: number) {
        const startTime = browser.now();

        const shouldPausePlacement = () => {
            const elapsedTime = browser.now() - startTime;
            return this._forceFullPlacement ? false : elapsedTime > 2;
        };

        while (this._currentPlacementIndex >= 0) {
            const layerId = order[this._currentPlacementIndex];
            const layer = layers[layerId];
            const placementZoom = this.placement.collisionIndex.transform.zoom;
            if (layer.type === 'symbol' &&
                (!layer.minzoom || layer.minzoom <= placementZoom) &&
                (!layer.maxzoom || layer.maxzoom > placementZoom)) {

                const symbolLayer = layer;
                const zOffset = symbolLayer.layout.get('symbol-z-elevate');

                const hasSymbolSortKey = symbolLayer.layout.get('symbol-sort-key').constantOr(1) !== undefined;
                const symbolZOrder = symbolLayer.layout.get('symbol-z-order');
                const sortSymbolByKey = symbolZOrder !== 'viewport-y' && hasSymbolSortKey;
                const zOrderByViewportY = symbolZOrder === 'viewport-y' || (symbolZOrder === 'auto' && !sortSymbolByKey);
                const canOverlap =
                    symbolLayer.layout.get('text-allow-overlap') ||
                    symbolLayer.layout.get('icon-allow-overlap') ||
                    symbolLayer.layout.get('text-ignore-placement') ||
                    symbolLayer.layout.get('icon-ignore-placement');
                const sortSymbolByViewportY = zOrderByViewportY && canOverlap;

                const inProgressLayer = this._inProgressLayer = this._inProgressLayer || new LayerPlacement(symbolLayer);

                const sourceId = makeFQID(layer.source, layer.scope);
                const sortTileByY = zOffset || sortSymbolByViewportY;
                const pausePlacement = inProgressLayer.continuePlacement(sortTileByY ? layerTilesInYOrder[sourceId] : layerTiles[sourceId], this.placement, this._showCollisionBoxes, layer, shouldPausePlacement, scaleFactor);

                if (pausePlacement) {
                    PerformanceUtils.recordPlacementTime(browser.now() - startTime);
                    // We didn't finish placing all layers within 2ms,
                    // but we can keep rendering with a partial placement
                    // We'll resume here on the next frame
                    return;
                }

                delete this._inProgressLayer;
            }

            this._currentPlacementIndex--;
        }
        PerformanceUtils.recordPlacementTime(browser.now() - startTime);
        this._done = true;
    }

    commit(now: number): Placement {
        this.placement.commit(now);
        return this.placement;
    }
}

export default PauseablePlacement;
