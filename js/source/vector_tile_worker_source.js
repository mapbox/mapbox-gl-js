'use strict';
var ajax = require('../util/ajax');
var vt = require('vector-tile');
var Protobuf = require('pbf');
var WorkerTile = require('./worker_tile');
var util = require('../util/util');

module.exports = VectorTileWorkerSource;

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 *
 * @class VectorTileWorkerSource
 * @private
 * @param {Function} [loadVectorData] Optional method for custom loading of a VectorTile object based on parameters passed from the main-thread Source.  See {@link VectorTileWorkerSource#loadTile}.  The default implementation simply loads the pbf at `params.url`.
 */
function VectorTileWorkerSource (actor, styleLayers, loadVectorData) {
    this.actor = actor;
    this.styleLayers = styleLayers;

    if (loadVectorData) { this.loadVectorData = loadVectorData; }

    this.loading = {};
    this.loaded = {};
}

VectorTileWorkerSource.prototype = {
    /**
     * Implements {@link WorkerSource#loadTile}.  Delegates to {@link VectorTileWorkerSource#loadVectorData} (which by default expects a `params.url` property) for fetching and producing a VectorTile object.
     *
     * @param {object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     * @param {TileCoord} params.coord
     * @param {number} params.zoom
     * @param {number} params.overscaling
     * @param {number} params.angle
     * @param {number} params.pitch
     * @param {boolean} params.showCollisionBoxes
     */
    loadTile: function(params, callback) {
        var source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};

        var workerTile = this.loading[source][uid] = new WorkerTile(params);
        workerTile.abort = this.loadVectorData(params, done.bind(this));

        function done(err, vectorTile) {
            delete this.loading[source][uid];

            if (err) return callback(err);
            if (!vectorTile) return callback(null, null);

            workerTile.vectorTile = vectorTile;
            workerTile.parse(vectorTile, this.styleLayers.getLayerFamilies(), this.actor, function (err, result, transferrables) {
                if (err) return callback(err);

                // Not transferring rawTileData because the worker needs to retain its copy.
                callback(null,
                    util.extend({rawTileData: vectorTile.rawData}, result),
                    transferrables);
            });

            this.loaded[source] = this.loaded[source] || {};
            this.loaded[source][uid] = workerTile;
        }
    },

    /**
     * Implements {@link WorkerSource#reloadTile}.
     *
     * @param {object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     */
    reloadTile: function(params, callback) {
        var loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            var workerTile = loaded[uid];
            workerTile.parse(workerTile.vectorTile, this.styleLayers.getLayerFamilies(), this.actor, callback);
        }
    },

    /**
     * Implements {@link WorkerSource#abortTile}.
     *
     * @param {object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     */
    abortTile: function(params) {
        var loading = this.loading[params.source],
            uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort();
            delete loading[uid];
        }
    },

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param {object} params
     * @param {string} params.source The id of the source for which we're loading this tile.
     * @param {string} params.uid The UID for this tile.
     */
    removeTile: function(params) {
        var loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    },

    /**
     * @class VectorTile
     *
     * The result passed to the `loadVectorData` callback must conform to the interface established
     * by the `VectorTile` class from the [vector-tile](https://www.npmjs.com/package/vector-tile)
     * npm package. In addition, it must have a `rawData` property containing an `ArrayBuffer`
     * with protobuf data conforming to the
     * [Mapbox Vector Tile specification](https://github.com/mapbox/vector-tile-spec).
     *
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
     * @param {object} params
     * @param {string} params.url The URL of the tile PBF to load.
     * @param {LoadVectorDataCallback} callback
     */
    loadVectorData: function (params, callback) {
        var xhr = ajax.getArrayBuffer(params.url, done.bind(this));
        return function abort () { xhr.abort(); };
        function done(err, arrayBuffer) {
            if (err) { return callback(err); }
            var vectorTile = new vt.VectorTile(new Protobuf(arrayBuffer));
            vectorTile.rawData = arrayBuffer;
            callback(err, vectorTile);
        }
    },

    redoPlacement: function(params, callback) {
        var loaded = this.loaded[params.source],
            loading = this.loading[params.source],
            uid = params.uid;

        if (loaded && loaded[uid]) {
            var workerTile = loaded[uid];
            var result = workerTile.redoPlacement(params.angle, params.pitch, params.showCollisionBoxes);

            if (result.result) {
                callback(null, result.result, result.transferables);
            }

        } else if (loading && loading[uid]) {
            loading[uid].angle = params.angle;
        }
    }
};
