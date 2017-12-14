// @flow

const ajax = require('../util/ajax');
const vt = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const WorkerTile = require('./worker_tile');
const util = require('../util/util');
const geojsonvt = require('geojson-vt');
const rewind = require('geojson-rewind');
const EXTENT = require('../data/extent');
const supercluster = require('supercluster');
const GeoJSONWrapper = require('./geojson_wrapper');
const vtpbf = require('vt-pbf');
const tileUtils = require('../util/tile_utils');

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

    if ((params.request.url + '').indexOf('tiles.mapbox.com') >= 0) {
        return loadVectorTileOriginal(params, callback);
    }

    const tileLatLngBounds = tileUtils.tileCoordToBounds(params.coord);
    const replacedRequestUrl = params.request.url.replace(/{{'(.*)' column condition}}/, function(entireMatch, columnId){
        return `within_box(${columnId}, ${tileLatLngBounds.getSouth()}, ${tileLatLngBounds.getWest()}, ${tileLatLngBounds.getNorth()}, ${tileLatLngBounds.getEast()})`;
      })
      .replace(/{snap_zoom}/, Math.max(params.zoom - 6, 1))
      .replace(/{snap_precision}/, 0.0001/(2*params.zoom) );


    const xhr = ajax.getJSON({url: replacedRequestUrl}, (err, data) => {
        if (err || !data) {
            return callback(err);
        } else if (typeof data !== 'object') {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        } else {
            rewind(data, true);

            try {
                const options = params.options || {};
                const scale = EXTENT / params.tileSize;
                console.log('params', params);
                let index;
                if (options.cluster) {
                  const superclusterOptions = {
                      // TODO: Work based on current zoom level.
                      minZoom: params.zoom - 3,
                      maxZoom: params.zoom + 3,
                      extent: EXTENT,
                      radius: (options.clusterRadius || 50) * scale
                  };
                  if (options.aggregateBy) {
                      superclusterOptions.map = function(props) {
                          return {sum: Number(props[options.aggregateBy]) || 1};
                      }
                      superclusterOptions.reduce = function (accumulated, props) {
                          accumulated.sum += props.sum;
                      }
                      superclusterOptions.initial = function () {
                          return {sum: 0};
                      }
                  }
                  console.log('superclusterOptions', superclusterOptions);
                  index = supercluster(superclusterOptions).load(data.features);
                } else {
                  const geojsonVtOptions = {
                    buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
                    tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
                    extent: EXTENT,
                    // TODO: Work based on current zoom level.
                    maxZoom: params.zoom
                  }
                  index = geojsonvt(data, geojsonVtOptions)
                }

                const geoJSONTile = index.getTile(params.zoom, params.coord.x, params.coord.y);
                if (!geoJSONTile) {
                    return; // callback(null);
                }
                const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

                let pbf = vtpbf(geojsonWrapper);
                // if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
                //     // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
                //     pbf = new Uint8Array(pbf);
                // }
                callback(null, {
                    vectorTile: geojsonWrapper,
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

function loadVectorTileOriginal(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
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
