// @flow

const ajax = require('../util/ajax');
const rewind = require('geojson-rewind');
const GeoJSONWrapper = require('./geojson_wrapper');
const vtpbf = require('vt-pbf');
const supercluster = require('supercluster');
const geojsonvt = require('geojson-vt');
const assert = require('assert');

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

export type CoalesceParameters = {
    source: string
};

export type LoadGeoJSON = (params: LoadGeoJSONParameters, callback: Callback<mixed>) => void;

export interface GeoJSONIndex {
}

function loadGeoJSONTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const source = params.source,
        canonical = params.tileID.canonical;

    if (!this._sources[source] || !this._sources[source].geoJSONIndex) {
        return callback(null, null);  // we couldn't load the file
    }

    const geoJSONTile = this._sources[source].geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
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

export type SourceState =
    | 'Idle'            // Source empty or data loaded
    | 'Coalescing'      // Data finished loading, but discard 'loadData' messages until receiving 'coalesced'
    | 'NeedsLoadData';  // 'loadData' received while coalescing, trigger one more 'loadData' on receiving 'coalesced'

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
    loadGeoJSON: LoadGeoJSON;
    _sources: { [string]: {
        state?: SourceState,
        pendingCallback?: Callback<boolean>,
        pendingLoadDataParams?: LoadGeoJSONParameters,
        geoJSONIndex?: GeoJSONIndex // object mapping source ids to geojson-vt-like tile indexes
    }};

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
        this._sources = {};
    }

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
     * expecting `callback(error, data)` to be called with either an error or a
     * parsed GeoJSON object.
     *
     * When `loadData` requests come in faster than they can be processed,
     * they are coalesced into a single request using the latest data.
     * See {@link GeoJSONWorkerSource#coalesce}
     *
     * @param params
     * @param params.source The id of the source.
     * @param callback
     */
    loadData(params: LoadGeoJSONParameters, callback: Callback<boolean>) {
        if (!this._sources[params.source]) {
            this._sources[params.source] = {};
        }
        const source = this._sources[params.source];

        if (source.pendingCallback) {
            // Tell the foreground the previous call has been abandoned
            source.pendingCallback(null, true);
        }
        source.pendingCallback = callback;
        source.pendingLoadDataParams = params;

        if (source.state &&
            source.state !== 'Idle') {
            source.state = 'NeedsLoadData';
        } else {
            source.state = 'Coalescing';
            this._loadData(params.source);
        }
    }

    /**
     * Internal implementation: called directly by `loadData`
     * or by `coalesce` using stored parameters.
     */
    _loadData(sourceId: string) {
        const source = this._sources[sourceId];
        if (!source.pendingCallback || !source.pendingLoadDataParams) {
            assert(false);
            return;
        }
        const callback = source.pendingCallback;
        const params = source.pendingLoadDataParams;
        delete source.pendingCallback;
        delete source.pendingLoadDataParams;
        this.loadGeoJSON(params, (err, data) => {
            if (err || !data) {
                return callback(err);
            } else if (typeof data !== 'object') {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            } else {
                rewind(data, true);

                try {
                    source.geoJSONIndex = params.cluster ?
                        supercluster(params.superclusterOptions).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                } catch (err) {
                    return callback(err);
                }

                this.loaded[params.source] = {};
                callback(null);
            }
        });
    }

    /**
     * While processing `loadData`, we coalesce all further
     * `loadData` messages into a single call to _loadData
     * that will happen once we've finished processing the
     * first message. {@link GeoJSONSource#_updateWorkerData}
     * is responsible for sending us the `coalesce` message
     * at the time it receives a response from `loadData`
     *
     *          State: Idle
     *          ↑          |
     *     'coalesce'   'loadData'
     *          |     (triggers load)
     *          |          ↓
     *        State: Coalescing
     *          ↑          |
     *   (triggers load)   |
     *     'coalesce'   'loadData'
     *          |          ↓
     *        State: NeedsLoadData
     */
    coalesce(params: CoalesceParameters) {
        const source = this._sources[params.source];
        if (!source) {
            return; // coalesce queued after removeSource
        }
        if (source.state === 'Coalescing') {
            source.state = 'Idle';
        } else if (source.state === 'NeedsLoadData') {
            source.state = 'Coalescing';
            this._loadData(params.source);
        }
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
        const removedSource = this._sources[params.source];
        if (removedSource) {
            if (removedSource.pendingCallback) {
                // Don't leak callbacks
                removedSource.pendingCallback(null, true);
            }
            delete this._sources[params.source];
        }
        callback();
    }
}

module.exports = GeoJSONWorkerSource;
