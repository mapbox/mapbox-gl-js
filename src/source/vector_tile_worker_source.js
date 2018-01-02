// @flow

const ajax = require('../util/ajax');
const vt = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const WorkerTile = require('./worker_tile');
const util = require('../util/util');
const geojsonToVectorTile = require('./geojson_to_vector_tile')
const vtpbf = require('vt-pbf');
const rewind = require('geojson-rewind');

import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerTileCallback,
    TileParameters
} from '../source/worker_source';

import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';
import type {Callback} from '../types/callback';

export type LoadVectorTileResult = {
    vectorTile: VectorTile;
    rawData: ArrayBuffer;
    expires?: any;
    cacheControl?: any;
};

/**
 * @callback LoadVectorDataCallback
 * @param error
 * @param vectorTile
 * @private
 */
export type LoadVectorDataCallback = Callback<?LoadVectorTileResult>;

export type AbortVectorData = () => void;
export type LoadVectorData = (params: WorkerTileParameters, callback: LoadVectorDataCallback) => ?AbortVectorData;

/**
 * @private
 */

function loadVectorTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const options = params.options || {};
    if (params.options.geojsonTile === true) {
        return loadGeojsonTile(params, callback)
    } else {
        return defaultLoadVectorTile(params, callback);
    }
}

function loadGeojsonTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const options = params.options || {};
    const tileUrlOptions = {
      snapZoom: options.snapZoom,
      snapPrecision: options.snapPrecision,
      simplifyPrecision: options.simplifyPrecision
    }

    const xhr = ajax.getJSON(params.request, (err, data) => {
        if (err || !data) {
            return callback(err);
        } else if (typeof data !== 'object') {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        } else {
            rewind(data, true);

            try {
                const geojsonWrappedVectorTile = geojsonToVectorTile(data, options, params.tileSize, params.zoom, params.coord);

                if (!geojsonWrappedVectorTile) {
                    return;
                    // return callback(null, null);
                }

                let pbf = vtpbf(geojsonWrappedVectorTile);
                if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
                    // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
                    pbf = new Uint8Array(pbf);
                }
                callback(null, {
                    vectorTile: geojsonWrappedVectorTile,
                    rawData: pbf.buffer,
                    cacheControl: 'max-age=90000',
                    expires: undefined
                });
            } catch (err) {
                return callback(err);
            }
        }
    });

    return () => {
        xhr.abort();
        callback();
    };
}

function defaultLoadVectorTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const xhr = ajax.getArrayBuffer(params.request, (err, response) => {
        if (err) {
            callback(err);
        } else if (response) {
            callback(null, {
                vectorTile: new vt.VectorTile(new Protobuf(response.data)),
                rawData: response.data,
                cacheControl: response.cacheControl,
                expires: response.expires
            });
        }
    });
    return () => {
        xhr.abort();
        callback();
    };
}

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 *
 * @private
 */
class VectorTileWorkerSource implements WorkerSource {
    actor: Actor;
    layerIndex: StyleLayerIndex;
    loadVectorData: LoadVectorData;
    loading: { [string]: { [string]: WorkerTile } };
    loaded: { [string]: { [string]: WorkerTile } };

    /**
     * @param [loadVectorData] Optional method for custom loading of a VectorTile
     * object based on parameters passed from the main-thread Source. See
     * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
     * loads the pbf at `params.url`.
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, loadVectorData: ?LoadVectorData) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.loadVectorData = loadVectorData || loadVectorTile;
        this.loading = {};
        this.loaded = {};
    }

    /**
     * Implements {@link WorkerSource#loadTile}. Delegates to
     * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
     * a `params.url` property) for fetching and producing a VectorTile object.
     */
    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};

        const workerTile = this.loading[source][uid] = new WorkerTile(params);
        workerTile.abort = this.loadVectorData(params, (err, response) => {
            delete this.loading[source][uid];

            if (err || !response) {
                return callback(err);
            }

            const rawTileData = response.rawData;
            const cacheControl = {};
            if (response.expires) cacheControl.expires = response.expires;
            if (response.cacheControl) cacheControl.cacheControl = response.cacheControl;

            workerTile.vectorTile = response.vectorTile;
            workerTile.parse(response.vectorTile, this.layerIndex, this.actor, (err, result, transferrables) => {
                if (err || !result) return callback(err);

                // Not transferring rawTileData because the worker needs to retain its copy.
                callback(null,
                    util.extend({rawTileData}, result, cacheControl),
                    transferrables);
            });

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][uid] = workerTile;
        });
    }

    /**
     * Implements {@link WorkerSource#reloadTile}.
     */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded[params.source],
            uid = params.uid,
            vtSource = this;
        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];
            workerTile.showCollisionBoxes = params.showCollisionBoxes;

            if (workerTile.status === 'parsing') {
                workerTile.reloadCallback = callback;
            } else if (workerTile.status === 'done') {
                workerTile.parse(workerTile.vectorTile, this.layerIndex, this.actor, done.bind(workerTile));
            }

        }

        function done(err, data) {
            if (this.reloadCallback) {
                const reloadCallback = this.reloadCallback;
                delete this.reloadCallback;
                this.parse(this.vectorTile, vtSource.layerIndex, vtSource.actor, reloadCallback);
            }

            callback(err, data);
        }
    }

    /**
     * Implements {@link WorkerSource#abortTile}.
     *
     * @param params
     * @param params.source The id of the source for which we're loading this tile.
     * @param params.uid The UID for this tile.
     */
    abortTile(params: TileParameters, callback: WorkerTileCallback) {
        const loading = this.loading[params.source],
            uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort();
            delete loading[uid];
        }
        callback();
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param params
     * @param params.source The id of the source for which we're loading this tile.
     * @param params.uid The UID for this tile.
     */
    removeTile(params: TileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
        callback();
    }
}

module.exports = VectorTileWorkerSource;
