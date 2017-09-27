// @flow

const browser = require('../util/browser');
const CollisionIndex = require('../symbol/collision_index');

import type Transform from '../geo/transform';
import type StyleLayer from './style_layer';
import type SourceCache from '../source/source_cache';

class LayerPlacement {
    _currentTileIndex: number;
    _tileIDs: Array<number>;

    constructor(sourceCache) {
        this._currentTileIndex = 0;
        this._tileIDs = sourceCache.getRenderableIds();
    }

    continuePlacement(sourceCache, collisionIndex, showCollisionBoxes: boolean, layer, shouldPausePlacement) {
        while (this._currentTileIndex < this._tileIDs.length) {
            const tile = sourceCache.getTileByID(this._tileIDs[this._currentTileIndex]);
            tile.placeLayer(showCollisionBoxes, collisionIndex, layer);

            this._currentTileIndex++;
            if (shouldPausePlacement()) {
                return true;
            }
        }
    }
}

class Placement {
    collisionIndex: CollisionIndex;
    _done: number;
    _currentPlacementIndex: number;
    _forceFullPlacement: boolean;
    _showCollisionBoxes: boolean;
    _delayUntil: number;
    _collisionFadeTimes: any;
    _inProgressLayer: ?LayerPlacement;

    constructor(transform: Transform, order: Array<string>,
            forceFullPlacement: boolean, showCollisionBoxes: boolean, fadeDuration: number,
            previousPlacement: ?Placement) {

        this.collisionIndex = new CollisionIndex(transform.clone());
        this._currentPlacementIndex = order.length - 1;
        this._forceFullPlacement = forceFullPlacement;
        this._showCollisionBoxes = showCollisionBoxes;

        if (forceFullPlacement || !previousPlacement) {
            this._delayUntil = browser.now();
        } else {
            this._delayUntil = previousPlacement._delayUntil + 300;
        }

        if (previousPlacement) {
            this._collisionFadeTimes = previousPlacement._collisionFadeTimes;
        } else {
            this._collisionFadeTimes = {
                latestStart: 0,
                duration: fadeDuration
            };
        }
    }

    isDone() {
        return Boolean(this._done);
    }

    continuePlacement(order: Array<string>, layers: {[string]: StyleLayer}, sourceCaches: {[string]: SourceCache}) {
        const startTime = browser.now();

        if (startTime < this._delayUntil) return true;

        const shouldPausePlacement = () => {
            const elapsedTime = browser.now() - startTime;
            return this._forceFullPlacement ? false : elapsedTime > 2;
        };

        while (this._currentPlacementIndex >= 0) {
            const layerId = order[this._currentPlacementIndex];
            const layer = layers[layerId];
            if (layer.type === 'symbol') {
                const sourceCache = sourceCaches[layer.source];

                if (!this._inProgressLayer) {
                    this._inProgressLayer = new LayerPlacement(sourceCache);
                }

                const pausePlacement = this._inProgressLayer.continuePlacement(sourceCache, this.collisionIndex, this._showCollisionBoxes, layer, shouldPausePlacement);

                if (pausePlacement) {
                    // We didn't finish placing all layers within 2ms,
                    // but we can keep rendering with a partial placement
                    // We'll resume here on the next frame
                    return;
                }

                delete this._inProgressLayer;
            }

            this._currentPlacementIndex--;
        }

        for (const id in sourceCaches) {
            sourceCaches[id].commitPlacement(this.collisionIndex, this._collisionFadeTimes);
        }

        this._done = browser.now();
    }

    stillFading() {
        return Date.now() < this._collisionFadeTimes.latestStart + this._collisionFadeTimes.duration;
    }

}

module.exports = Placement;
