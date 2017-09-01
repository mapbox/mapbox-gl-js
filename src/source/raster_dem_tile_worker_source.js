// @flow

const WorkerTile = require('./worker_tile');
const {DEMData} = require('../data/dem_data');

import type {
    WorkerSource,
    WorkerRasterTileParameters,
    WorkerTileCallback
} from '../source/worker_source';

import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';


/**
 * The {@link WorkerSource} implementation that supports {@link RasterDEMTileSource}.
 *
 * @private
 */

class RasterDEMTileWorkerSource implements WorkerSource {
    actor: Actor;
    layerIndex: StyleLayerIndex;
    loading: { [string]: { [string]: WorkerTile } };
    loaded: { [string]: { [string]: WorkerTile } };

    constructor(actor: Actor, layerIndex: StyleLayerIndex) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.loading = {};
        this.loaded = {};
    }

    /**
     * Implements {@link WorkerSource#loadTile}.
     */
    loadTile(params: WorkerRasterTileParameters, callback: WorkerTileCallback) {
        const source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};

        const dem = new DEMData(uid);
        dem.loadFromImage(params.rawImageData);
        const transferrables = [];
        callback(null, dem.serialize(transferrables), transferrables);
    }

}

module.exports = RasterDEMTileWorkerSource;
