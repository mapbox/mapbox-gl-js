'use strict';
const ajax = require('../util/ajax');
const vt = require('vector-tile');
const Protobuf = require('pbf');
const WorkerTile = require('./worker_tile');
const util = require('../util/util');

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 *
 * @private
 */
class VectorTileWorkerSource {
    /**
     * @param {Function} [loadVectorData] Optional method for custom loading of a VectorTile object based on parameters passed from the main-thread Source.  See {@link VectorTileWorkerSource#loadTile}.  The default implementation simply loads the pbf at `params.url`.
     */
    constructor(actor, layerIndex, loadVectorData) {
        this.actor = actor;
        this.layerIndex = layerIndex;

        if (loadVectorData) { this.loadVectorData = loadVectorData; }

        this.loading = {};
        this.loaded = {};
    }

    /**
     * Implements {@link WorkerSource#loadTile}.  Delegates to {@link VectorTileWorkerSource#loadVectorData} (which by default expects a `params.url` property) for fetching and producing a VectorTile object.
     *
     * @param {Object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     * @param {TileCoord} params.coord
     * @param {number} params.zoom
     * @param {number} params.overscaling
     * @param {number} params.angle
     * @param {number} params.pitch
     * @param {boolean} params.showCollisionBoxes
     */
    loadTile(params, callback) {
        const source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};

        const workerTile = this.loading[source][uid] = new WorkerTile(params);
        workerTile.abort = this.loadVectorData(params, done.bind(this));

        function done(err, vectorTile) {
            delete this.loading[source][uid];

            if (err) return callback(err);
            if (!vectorTile) return callback(null, null);

            workerTile.vectorTile = vectorTile;
            workerTile.parse(vectorTile, this.layerIndex, this.actor, (err, result, transferrables) => {
                if (err) return callback(err);

                const cacheControl = {};
                if (vectorTile.expires) cacheControl.expires = vectorTile.expires;
                if (vectorTile.cacheControl) cacheControl.cacheControl = vectorTile.cacheControl;

                // Not transferring rawTileData because the worker needs to retain its copy.
                callback(null,
                    util.extend({rawTileData: vectorTile.rawData}, result, cacheControl),
                    transferrables);
            });

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][uid] = workerTile;
        }
    }

    /**
     * Implements {@link WorkerSource#reloadTile}.
     *
     * @param {Object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     */
    reloadTile(params, callback) {
        const loaded = this.loaded[params.source],
            uid = params.uid,
            vtSource = this;
        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];

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
     * @param {Object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     */
    abortTile(params) {
        const loading = this.loading[params.source],
            uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort();
            delete loading[uid];
        }
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param {Object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     */
    removeTile(params) {
        const loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }

    /**
     * The result passed to the `loadVectorData` callback must conform to the interface established
     * by the `VectorTile` class from the [vector-tile](https://www.npmjs.com/package/vector-tile)
     * npm package. In addition, it must have a `rawData` property containing an `ArrayBuffer`
     * with protobuf data conforming to the
     * [Mapbox Vector Tile specification](https://github.com/mapbox/vector-tile-spec).
     *
     * @class VectorTile
     * @property {ArrayBuffer} rawData
     * @private
     */

    /**
     * @callback LoadVectorDataCallback
     * @param {Error?} error
     * @param {VectorTile?} vectorTile
     * @private
     */

    /**
     * @param {Object} params
     * @param {string} params.url The URL of the tile PBF to load.
     * @param {LoadVectorDataCallback} callback
     */
    loadVectorData(params, callback) {
        const xhr = ajax.getArrayBuffer(params.url, done.bind(this));
        return function abort () { xhr.abort(); };
        function done(err, response) {
            if (err) { return callback(err); }
            const vectorTile = new vt.VectorTile(new Protobuf(response.data));
            vectorTile.rawData = response.data;
            vectorTile.cacheControl = response.cacheControl;
            vectorTile.expires = response.expires;
            callback(err, vectorTile);
        }
    }

    redoPlacement(params, callback) {
        const loaded = this.loaded[params.source],
            loading = this.loading[params.source],
            uid = params.uid;

        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];
            const result = workerTile.redoPlacement(params.angle, params.pitch, params.showCollisionBoxes);

            if (result.result) {
                callback(null, result.result, result.transferables);
            }

        } else if (loading && loading[uid]) {
            loading[uid].angle = params.angle;
        }
    }
}

module.exports = VectorTileWorkerSource;
