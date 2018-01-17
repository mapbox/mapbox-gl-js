// @flow

const ajax = require('../util/ajax');
const perf = require('../util/performance');
const rewind = require('geojson-rewind');
const GeoJSONWrapper = require('./geojson_wrapper');
const vtpbf = require('vt-pbf');
const supercluster = require('supercluster');
const geojsonvt = require('geojson-vt');

const VectorTileWorkerSource = require('./vector_tile_worker_source');

import type {
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';

import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';

import type {LoadVectorDataCallback} from './vector_tile_worker_source';
import type {RequestParameters} from '../util/ajax';
import type { Callback } from '../types/callback';

export type GeoJSON = Object;

export type LoadGeoJSONParameters = {
    request?: RequestParameters,
    data?: string,
    source: string,
    superclusterOptions?: Object,
    geojsonVtOptions?: Object
};

export type LoadGeoJSON = (params: LoadGeoJSONParameters, callback: Callback<mixed>) => void;

export interface GeoJSONIndex {
}

function loadGeoJSONTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const source = params.source,
        canonical = params.tileID.canonical;

    if (!this._geoJSONIndexes[source]) {
        return callback(null, null);  // we couldn't load the file
    }

    const geoJSONTile = this._geoJSONIndexes[source].getTile(canonical.z, canonical.x, canonical.y);
    if (!geoJSONTile) {
        return callback(null, null); // nothing in the given tile
    }

    const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

    // Encode the geojson-vt tile into binary vector tile form form.  This
    // is a convenience that allows `FeatureIndex` to operate the same way
    // across `VectorTileSource` and `GeoJSONSource` data.
    let pbf = vtpbf(geojsonWrapper);
    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
        pbf = new Uint8Array(pbf);
    }

    callback(null, {
        vectorTile: geojsonWrapper,
        rawData: pbf.buffer
    });
}

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
 * @private
 */
class GeoJSONWorkerSource extends VectorTileWorkerSource {
    _geoJSONIndexes: { [string]: GeoJSONIndex };
    loadGeoJSON: LoadGeoJSON;

    /**
     * @param [loadGeoJSON] Optional method for custom loading/parsing of
     * GeoJSON based on parameters passed from the main-thread Source.
     * See {@link GeoJSONWorkerSource#loadGeoJSON}.
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, loadGeoJSON: ?LoadGeoJSON) {
        super(actor, layerIndex, loadGeoJSONTile);
        if (loadGeoJSON) {
            this.loadGeoJSON = loadGeoJSON;
        }
        // object mapping source ids to geojson-vt-like tile indexes
        this._geoJSONIndexes = {};
    }

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
     * expecting `callback(error, data)` to be called with either an error or a
     * parsed GeoJSON object.
     * @param params
     * @param params.source The id of the source.
     * @param callback
     */
    loadData(params: LoadGeoJSONParameters, callback: Callback<{[string]: {[string]: Array<PerformanceResourceTiming>}}>) {
        this.loadGeoJSON(params, (err, data) => {
            if (err || !data) {
                return callback(err);
            } else if (typeof data !== 'object') {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            } else {
                rewind(data, true);

                try {
                    this._geoJSONIndexes[params.source] = params.cluster ?
                        supercluster(params.superclusterOptions).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                } catch (err) {
                    return callback(err);
                }

                this.loaded[params.source] = {};

                const result = {};
                if (params.request && params.request.collectResourceTiming) {
                    const resourceTimingData = perf.getEntriesByName(params.request.url);
                    // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                    // late evaluation in the main thread causes TypeError: illegal invocation
                    if (resourceTimingData) {
                        result.resourceTiming = {};
                        result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                    }
                }
                callback(null, result);
            }
        });
    }

    /**
    * Implements {@link WorkerSource#reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params
    * @param params.source The id of the source for which we're loading this tile.
    * @param params.uid The UID for this tile.
    */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded[params.source],
            uid = params.uid;

        if (loaded && loaded[uid]) {
            return super.reloadTile(params, callback);
        } else {
            return this.loadTile(params, callback);
        }
    }

    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param params
     * @param [params.url] A URL to the remote GeoJSON data.
     * @param [params.data] Literal GeoJSON data. Must be provided if `params.url` is not.
     */
    loadGeoJSON(params: LoadGeoJSONParameters, callback: Callback<mixed>) {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            ajax.getJSON(params.request, callback);
        } else if (typeof params.data === 'string') {
            try {
                return callback(null, JSON.parse(params.data));
            } catch (e) {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            }
        } else {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        }
    }

    removeSource(params: {source: string}, callback: Callback<mixed>) {
        if (this._geoJSONIndexes[params.source]) {
            delete this._geoJSONIndexes[params.source];
        }
        callback();
    }
}

module.exports = GeoJSONWorkerSource;
